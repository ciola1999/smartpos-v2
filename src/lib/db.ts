// smart-pos\src\lib\db.ts

import Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "@/db/schema";

export type TauriDB = ReturnType<typeof drizzle<typeof schema>>;

let db: TauriDB | null = null;

/**
 * Membersihkan error message dari Tauri SQL plugin.
 * Tauri kadang mengirim error message yang dibungkus dalam tanda kutip ganda.
 */
function cleanErrorMessage(e: unknown): string {
	let msg =
		e instanceof Error
			? e.message
			: typeof e === "string"
				? e
				: JSON.stringify(e);

	if (msg.startsWith('"') && msg.endsWith('"') && msg.length > 1) {
		try {
			msg = JSON.parse(msg);
		} catch {
			msg = msg.slice(1, -1);
		}
	}

	return msg;
}

/**
 * Konversi object row ke array of values sesuai urutan kolom dalam SQL.
 * Ini diperlukan karena Tauri SQL plugin mengembalikan object,
 * tapi Drizzle sqlite-proxy lebih reliable dengan array format.
 */
function rowObjectToArray(row: Record<string, unknown>): unknown[] {
	return Object.values(row);
}

export const initDb = async (): Promise<TauriDB> => {
	if (db) return db;

	try {
		const sqlite = await Database.load("sqlite:smartpos.db");

		db = drizzle(
			async (sql, params, method) => {
				try {
					// INSERT/UPDATE/DELETE tanpa RETURNING → gunakan execute
					if (method === "run") {
						const res = await sqlite.execute(sql, params);
						return {
							rows: [] as unknown[][],
							rowsAffected: res.rowsAffected,
							insertId: res.lastInsertId,
						};
					}

					// Deteksi apakah ini write statement (INSERT/UPDATE/DELETE) dengan RETURNING
					const trimmedSql = sql.trimStart().toLowerCase();
					const isWriteWithReturning =
						(trimmedSql.startsWith("insert") ||
							trimmedSql.startsWith("update") ||
							trimmedSql.startsWith("delete")) &&
						trimmedSql.includes("returning");

					// Jalankan query via select()
					// Tauri SQL plugin: select() bisa menjalankan INSERT...RETURNING di SQLite
					let rawRows: Record<string, unknown>[];

					if (isWriteWithReturning) {
						// Untuk write+returning, gunakan select() karena execute() tidak support RETURNING
						rawRows = await sqlite.select<Record<string, unknown>[]>(
							sql,
							params,
						);
					} else {
						// SELECT biasa
						rawRows = await sqlite.select<Record<string, unknown>[]>(
							sql,
							params,
						);
					}

					// Konversi semua rows ke format array-of-values
					// Drizzle sqlite-proxy bekerja paling reliable dengan format ini
					const mappedRows = rawRows.map(rowObjectToArray);

					return { rows: mappedRows };
				} catch (e: unknown) {
					const errorMessage = cleanErrorMessage(e);
					console.error("❌ SQL Error:", errorMessage);
					throw new Error(errorMessage);
				}
			},
			{ schema },
		);

		console.log("✅ Database initialized successfully");
		return db;
	} catch (error) {
		console.error("❌ Failed to initialize database:", error);
		throw error;
	}
};

export const getDb = (): TauriDB => {
	if (!db) {
		throw new Error(
			"Database not initialized! Call initDb() first in your app entry point.",
		);
	}
	return db;
};
