import * as schema from "@/db/schema";
import { initDb } from "@/lib/db";
import { createClient } from "@libsql/client";
import { eq, getTableColumns, sql } from "drizzle-orm";
import type { AnySQLiteTable, SQLiteColumn } from "drizzle-orm/sqlite-core";

/**
 * 🔒 Strictly typed interface for tables that support synchronization.
 * Each table MUST have id, version, and syncStatus columns.
 */
interface SyncableSQLiteTable extends AnySQLiteTable {
	id: SQLiteColumn;
	version: SQLiteColumn;
	syncStatus: SQLiteColumn;
}

const TABLES_TO_SYNC: { name: string; table: SyncableSQLiteTable }[] = [
	{ name: "users", table: schema.users as unknown as SyncableSQLiteTable },
	{
		name: "categories",
		table: schema.categories as unknown as SyncableSQLiteTable,
	},
	{
		name: "products",
		table: schema.products as unknown as SyncableSQLiteTable,
	},
	{
		name: "ingredients",
		table: schema.ingredients as unknown as SyncableSQLiteTable,
	},
	{
		name: "product_recipes",
		table: schema.productRecipes as unknown as SyncableSQLiteTable,
	},
	{ name: "members", table: schema.members as unknown as SyncableSQLiteTable },
	{
		name: "discounts",
		table: schema.discounts as unknown as SyncableSQLiteTable,
	},
	{ name: "taxes", table: schema.taxes as unknown as SyncableSQLiteTable },
	{ name: "orders", table: schema.orders as unknown as SyncableSQLiteTable },
	{
		name: "order_payments",
		table: schema.orderPayments as unknown as SyncableSQLiteTable,
	},
	{
		name: "inventory_logs",
		table: schema.inventoryLogs as unknown as SyncableSQLiteTable,
	},
	{ name: "shifts", table: schema.shifts as unknown as SyncableSQLiteTable },
	{
		name: "store_settings",
		table: schema.storeSettings as unknown as SyncableSQLiteTable,
	},
];

export const SyncService = {
	/**
	 * 🚀 PUSH: Upload local changes to Turso
	 */
	push: async (url: string, key: string) => {
		const db = await initDb();
		const client = createClient({ url, authToken: key });
		let totalSyncedCount = 0;

		try {
			for (const { name, table } of TABLES_TO_SYNC) {
				// Get physical column names mapping
				const columns = getTableColumns(table);

				const localDataRows = await db
					.select()
					.from(table)
					.where(eq(table.syncStatus, false));

				if (localDataRows.length === 0) continue;

				// Buat batch statements untuk Turso dengan sanitasi menyeluruh
				const statements = localDataRows
					.filter((row) => row && typeof row === "object" && Object.keys(row).length > 0)
					.map((row) => {
						const rowData = row as Record<string, unknown>;
						const keys: string[] = [];
						const sanitizedValues: (string | number | null)[] = [];
						let hasId = false;

						// 🛡️ Iterasi berdasarkan kolom skema
						for (const [propName, column] of Object.entries(columns)) {
							const dbColumnName = column.name;
							const val = rowData[propName];

							if (dbColumnName === "id" && val !== null && val !== undefined) {
								hasId = true;
							}

							keys.push(dbColumnName);

							// 🛑 Sanitasi lengkap
							if (val === null || val === undefined) {
								sanitizedValues.push(null);
							} else if (val instanceof Date) {
								const t = val.getTime();
								sanitizedValues.push(Number.isFinite(t) ? t : null);
							} else if (typeof val === "boolean") {
								sanitizedValues.push(val ? 1 : 0);
							} else if (typeof val === "number") {
								sanitizedValues.push(Number.isFinite(val) ? val : null);
							} else if (typeof val === "string") {
								sanitizedValues.push(val);
							} else if (typeof val === "bigint") {
								sanitizedValues.push(Number(val));
							} else {
								sanitizedValues.push(JSON.stringify(val));
							}
						}

						if (!hasId) {
							console.warn(`[Sync.Push] Skipping row in ${name} because ID is missing:`, row);
							return null;
						}

						const placeholders = keys.map(() => "?").join(", ");
						return {
							sql: `INSERT OR REPLACE INTO ${name} (${keys.join(", ")}) VALUES (${placeholders})`,
							args: sanitizedValues,
						};
					})
					.filter((stmt): stmt is Exclude<typeof stmt, null> => stmt !== null);

				if (statements.length === 0) continue;

				// Eksekusi batch di Turso
				await client.batch(statements, "write");

				// Update status lokal
				for (const row of localDataRows) {
					const typedRow = row as { id: string };
					await db
						.update(table)
						.set({ syncStatus: true })
						.where(eq(table.id, typedRow.id));
				}
				totalSyncedCount += localDataRows.length;
			}
		} finally {
			client.close();
		}

		return { success: true, count: totalSyncedCount };
	},

	/**
	 * 📥 PULL: Download changes from Turso
	 */
	pull: async (url: string, key: string) => {
		const db = await initDb();
		const client = createClient({ url, authToken: key });
		let totalUpdatedCount = 0;

		try {
			for (const { name, table } of TABLES_TO_SYNC) {
				// Get column mapping for reverse mapping (db -> prop)
				const columns = getTableColumns(table);
				const dbToPropMapping: Record<string, string> = {};
				for (const [propName, col] of Object.entries(columns)) {
					dbToPropMapping[col.name] = propName;
				}

				// Cari version tertinggi di lokal
				const versionQuery = await db
					.select({ version: table.version })
					.from(table)
					.orderBy(sql`${table.version} DESC`)
					.limit(1);

				const lastLocalVersion =
					(versionQuery[0] as { version: number } | undefined)?.version ?? 0;

				// Ambil data dari Turso yang version > lastLocalVersion
				const result = await client.execute({
					sql: `SELECT * FROM ${name} WHERE version > ? ORDER BY version ASC`,
					args: [lastLocalVersion],
				});

				const rows = result.rows;
				if (rows.length === 0) continue;

				for (const row of rows) {
					// 🛠️ FIX: Map snake_case DB keys back to camelCase prop names
					const mappedRow: Record<string, unknown> = {};
					for (const [dbKey, val] of Object.entries(row)) {
						const propName = dbToPropMapping[dbKey] || dbKey;
						mappedRow[propName] = val;
					}

					const rowWithStatus = { ...mappedRow, syncStatus: true };

					await db
						.insert(table)
						.values(rowWithStatus as typeof table.$inferInsert)
						.onConflictDoUpdate({
							target: table.id,
							set: rowWithStatus as typeof table.$inferInsert,
						});
				}
				totalUpdatedCount += rows.length;
			}
		} finally {
			client.close();
		}

		return { success: true, count: totalUpdatedCount };
	},
};
