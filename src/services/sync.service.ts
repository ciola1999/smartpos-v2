import {
  type Client,
  createClient,
  type InArgs,
  type InStatement,
  type InValue,
} from "@libsql/client";
import {
  eq,
  getTableColumns,
  inArray,
  sql,
  type TableConfig,
} from "drizzle-orm";
import type {
  SQLiteColumn,
  SQLiteTableWithColumns,
} from "drizzle-orm/sqlite-core";
import * as schema from "@/db/schema";
import { initDb, runTransactionWithRetry } from "@/lib/db";

// -----------------------------------------------------------------------------
// 1️⃣ OBSOLETE_STEP_SEE_INSTRUCTIONS & CONFIGURATION
// -----------------------------------------------------------------------------

/**
 * 🔒 Interface Table yang Valid untuk Sync
 */
type SyncableTable = SQLiteTableWithColumns<TableConfig> & {
  id: SQLiteColumn;
  version: SQLiteColumn;
  syncStatus: SQLiteColumn;
};

// Casting ke unknown dulu baru ke SyncableTable untuk bypass strict type checking Drizzle yang kompleks
const TABLES_TO_SYNC: { name: string; table: SyncableTable }[] = [
  { name: "users", table: schema.users as unknown as SyncableTable },
  { name: "categories", table: schema.categories as unknown as SyncableTable },
  { name: "products", table: schema.products as unknown as SyncableTable },
  {
    name: "ingredients",
    table: schema.ingredients as unknown as SyncableTable,
  },
  {
    name: "product_recipes",
    table: schema.productRecipes as unknown as SyncableTable,
  },
  { name: "members", table: schema.members as unknown as SyncableTable },
  { name: "discounts", table: schema.discounts as unknown as SyncableTable },
  { name: "taxes", table: schema.taxes as unknown as SyncableTable },
  { name: "orders", table: schema.orders as unknown as SyncableTable },
  { name: "order_items", table: schema.orderItems as unknown as SyncableTable },
  {
    name: "order_payments",
    table: schema.orderPayments as unknown as SyncableTable,
  },
  {
    name: "inventory_logs",
    table: schema.inventoryLogs as unknown as SyncableTable,
  },
  { name: "shifts", table: schema.shifts as unknown as SyncableTable },
  {
    name: "store_settings",
    table: schema.storeSettings as unknown as SyncableTable,
  },
];

// -----------------------------------------------------------------------------
// 2️⃣ HELPER FUNCTIONS (UTILITIES)
// -----------------------------------------------------------------------------

/**
 * 🧽 Sanitize: Persiapan data KELUAR (Local -> Cloud)
 * Return type wajib InValue agar kompatibel dengan LibSQL Client.
 */
function sanitizeForCloud(val: unknown): InValue {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.getTime(); // Timestamp (number)
  if (typeof val === "boolean") return val ? 1 : 0; // Integer (0/1)
  if (typeof val === "bigint") return Number(val); // Integer
  // LibSQL InValue supports: string, number, null, bigint, ArrayBuffer
  if (typeof val === "string" || typeof val === "number") return val;
  // Fallback safe convert to string
  return String(val);
}

/**
 * 🛰️ Normalize: Persiapan data MASUK (Cloud -> Local Drizzle)
 */
function normalizeFromCloud(
  val: unknown,
  colDef: SQLiteColumn | undefined,
): unknown {
  if (!colDef || val === null || val === undefined) return val;

  // Introspeksi properti internal Drizzle secara aman
  // Kita hanya butuh config.mode, tidak butuh getSQLType (unused var fix)
  const config = (colDef as unknown as { config?: { mode?: string } }).config;
  const mode = config?.mode;

  // Handle Timestamp
  if (mode === "timestamp_ms" || mode === "timestamp") {
    const dateVal = new Date(val as string | number);
    return Number.isNaN(dateVal.getTime()) ? null : dateVal;
  }

  // Handle Boolean
  if (mode === "boolean") {
    return val === 1 || val === "1" || val === true;
  }

  return val;
}

/**
 * 📦 Batch Builder
 * Membuat statement SQL Upsert untuk LibSQL Cloud.
 */
function buildUpsertStatement(
  tableName: string,
  row: Record<string, unknown>,
  columns: Record<string, SQLiteColumn>,
): InStatement | null {
  const keys: string[] = [];
  // Explicitly typed as InValue[] to match LibSQL expectation
  const values: InValue[] = [];
  const updateAssignments: string[] = [];
  let hasId = false;

  for (const [propName, column] of Object.entries(columns)) {
    const dbName = column.name;
    const rawVal = row[propName];

    // Force sync_status to 1 (true) for cloud consistency
    const val = dbName === "sync_status" ? 1 : sanitizeForCloud(rawVal);

    if (dbName === "id" && val) hasId = true;

    keys.push(dbName);
    values.push(val);

    if (dbName !== "id") {
      updateAssignments.push(`${dbName} = excluded.${dbName}`);
    }
  }

  if (!hasId) return null;

  const placeholders = keys.map(() => "?").join(", ");

  const sqlStr = `
    INSERT INTO ${tableName} (${keys.join(", ")}) 
    VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET 
    ${updateAssignments.join(", ")}
  `;

  // Return object strictly matching InStatement
  return { sql: sqlStr, args: values };
}

// -----------------------------------------------------------------------------
// 3️⃣ SYNC SERVICE CORE
// -----------------------------------------------------------------------------

export const SyncService = {
  /**
   * 🚀 PUSH: Upload perubahan lokal ke Cloud
   */
  push: async (cloudUrl: string, cloudKey: string) => {
    console.log("🚀 [SYNC] Starting PUSH...");
    const db = await initDb();
    let client: Client | null = null;
    let totalSynced = 0;

    try {
      client = createClient({ url: cloudUrl, authToken: cloudKey });

      for (const { name, table } of TABLES_TO_SYNC) {
        // 1. Ambil data lokal (dirty)
        const dirtyRows = await db
          .select()
          .from(table)
          .where(eq(table.syncStatus, false));

        if (dirtyRows.length === 0) continue;

        console.log(
          `📤 [PUSH] Pushing ${dirtyRows.length} rows from '${name}'...`,
        );

        const columns = getTableColumns(table);
        const statements: InStatement[] = [];

        // 2. Build Statements
        for (const row of dirtyRows) {
          const stmt = buildUpsertStatement(
            name,
            row as Record<string, unknown>,
            columns,
          );
          if (stmt) statements.push(stmt);
        }

        if (statements.length === 0) continue;

        // 3. Batch Execution
        const CHUNK_SIZE = 50;
        for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
          const chunk = statements.slice(i, i + CHUNK_SIZE);
          await client.batch(chunk, "write");
        }

        // 4. Acknowledge Local
        const rowIds = dirtyRows.map((r) => r.id as string);

        await runTransactionWithRetry(db, async (tx) => {
          await tx
            .update(table)
            .set({ syncStatus: true })
            .where(inArray(table.id, rowIds));
        });

        totalSynced += dirtyRows.length;
      }
    } catch (error) {
      console.error("❌ [SYNC] Push Failed:", error);
      throw error;
    } finally {
      if (client) client.close();
    }

    console.log(`✅ [SYNC] Push Completed. Total: ${totalSynced}`);
    return { success: true, count: totalSynced };
  },

  /**
   * 📥 PULL: Download perubahan dari Cloud ke Lokal
   */
  pull: async (cloudUrl: string, cloudKey: string) => {
    console.log("📥 [SYNC] Starting PULL...");
    const db = await initDb();
    let client: Client | null = null;
    let totalUpdated = 0;

    try {
      client = createClient({ url: cloudUrl, authToken: cloudKey });

      for (const { name, table } of TABLES_TO_SYNC) {
        // 1. Cek Versi Lokal Terakhir
        const maxVersionQuery = await db
          .select({ ver: table.version })
          .from(table)
          .orderBy(sql`${table.version} DESC`)
          .limit(1);

        // Pastikan konversi ke number aman
        const lastVersion = Number(maxVersionQuery[0]?.ver ?? 0);

        // 2. Fetch Delta dari Cloud
        // Gunakan interface InArgs untuk argumen
        const args: InArgs = [lastVersion];

        const result = await client.execute({
          sql: `SELECT * FROM ${name} WHERE version > ? ORDER BY version ASC`,
          args: args,
        });

        if (result.rows.length === 0) continue;

        console.log(
          `📥 [PULL] Downloading ${result.rows.length} rows for '${name}'...`,
        );

        // 3. Persiapan Mapping Data
        const columns = getTableColumns(table);

        // 4. Tulis ke Lokal dengan Transaksi Aman
        await runTransactionWithRetry(db, async (tx) => {
          for (const row of result.rows) {
            const insertData: Record<string, unknown> = {};
            const rawRowObj = row as Record<string, unknown>;

            for (const colDef of Object.values(columns)) {
              const dbColName = colDef.name;
              // Cari property key di object 'columns' yang valuenya adalah colDef ini
              const propName =
                Object.keys(columns).find(
                  (k) => columns[k].name === dbColName,
                ) || dbColName;

              if (rawRowObj[dbColName] !== undefined) {
                insertData[propName] = normalizeFromCloud(
                  rawRowObj[dbColName],
                  colDef,
                );
              }
            }

            insertData.syncStatus = true;

            // Use record type to avoid 'any'
            const typedInsertData = insertData as Record<
              string,
              Record<string, unknown>
            >[string];

            await tx.insert(table).values(typedInsertData).onConflictDoUpdate({
              target: table.id,
              set: typedInsertData,
            });
          }
        });

        totalUpdated += result.rows.length;
      }
    } catch (error) {
      console.error("❌ [SYNC] Pull Failed:", error);
      throw error;
    } finally {
      if (client) client.close();
    }

    console.log(`✅ [SYNC] Pull Completed. Total: ${totalUpdated}`);
    return { success: true, count: totalUpdated };
  },
};
