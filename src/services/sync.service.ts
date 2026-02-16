import { createClient } from "@libsql/client";
import { eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { AnySQLiteTable, SQLiteColumn } from "drizzle-orm/sqlite-core";
import * as schema from "@/db/schema";
import { initDb, type LocalDB } from "@/lib/db";

/**
 * 🔒 Strictly typed interface for tables that support synchronization.
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

/**
 * 🛡️ Helper: Sleep untuk Retry Logic
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type TransactionTx = Parameters<Parameters<LocalDB["transaction"]>[0]>[0];
/**
 * 🛡️ Helper: Retry Transaction Wrapper for SQLite
 * Menangani error 'database is locked' secara otomatis.
 */
async function runTransactionWithRetry<T>(
  db: LocalDB,
  operation: (tx: TransactionTx) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await db.transaction(operation);
    } catch (e: unknown) {
      const error = e as Error & { code?: string };

      const isLocked =
        error.message?.includes("database is locked") ||
        error.message?.includes("cannot rollback") ||
        error.code === "SQLITE_BUSY";

      if (isLocked && attempt < maxRetries - 1) {
        attempt++;
        const delay = 200 * attempt; // Backoff: 200ms, 400ms, 600ms
        await sleep(delay);
      } else {
        throw error; // Lempar error asli jika bukan locked
      }
    }
  }
  throw new Error("Transaction failed after max retries");
}

/**
 * 🛰️ Normalisasi Nilai: Konversi data dari Cloud (Turso) ke tipe Drizzle Lokal
 */
function normalizeSyncValue(
  val: unknown,
  colDef: SQLiteColumn | undefined,
): unknown {
  if (!colDef || val === null || val === undefined) return val;

  // @ts-expect-error - Access internal Drizzle metadata for mode
  const mode = (colDef as any).mode || (colDef as any).config?.mode;

  // Handle Timestamp Mode (Turso returns strings or numbers)
  if (mode === "timestamp_ms" || mode === "timestamp") {
    const date = new Date(val as string | number);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Handle Boolean Mode (LibSQL returns 0/1 for booleans)
  if (mode === "boolean") {
    return val === 1 || val === "1" || val === true;
  }

  return val;
}

/**
 * 🧽 Sanitize: Memberishkan nilai untuk dikirim ke Cloud
 */
function sanitizeSyncValue(val: unknown): string | number | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}

/**
 * 📝 Prepare: Membuat batch statement untuk satu tabel
 */
function preparePushStatements(
  tableName: string,
  localRows: unknown[],
  columns: Record<string, SQLiteColumn>,
) {
  return localRows
    .map((row) => {
      const rowData = row as Record<string, unknown>;
      const keys: string[] = [];
      const args: (string | number | null)[] = [];
      let hasId = false;

      for (const [propName, column] of Object.entries(columns)) {
        const dbName = column.name;
        const val = rowData[propName];

        if (dbName === "id" && val !== null && val !== undefined) hasId = true;

        keys.push(dbName);
        args.push(sanitizeSyncValue(val));
      }

      if (!hasId) return null;

      const placeholders = keys.map(() => "?").join(", ");
      return {
        sql: `INSERT OR REPLACE INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`,
        args,
      };
    })
    .filter((stmt): stmt is Exclude<typeof stmt, null> => stmt !== null);
}

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
        const columns = getTableColumns(table);

        const localDataRows = await db
          .select()
          .from(table)
          .where(eq(table.syncStatus, false));

        if (localDataRows.length === 0) continue;

        const statements = preparePushStatements(name, localDataRows, columns);
        if (statements.length === 0) continue;

        // 🔥 Chunking (Max 50 statements per batch to avoid LibSQL limits)
        const CHUNK_SIZE = 50;
        for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
          const chunk = statements.slice(i, i + CHUNK_SIZE);
          await client.batch(chunk, "write");
        }

        // Update status lokal (Mark as Synced) dalam satu batch
        const rowIds = localDataRows
          .map((r) => (r as { id: string }).id)
          .filter(Boolean);

        if (rowIds.length > 0) {
          await runTransactionWithRetry(db, async (tx) => {
            await tx
              .update(table)
              .set({ syncStatus: true })
              .where(inArray(table.id, rowIds));
          });
        }

        totalSyncedCount += localDataRows.length;
      }
    } catch (error) {
      console.error("❌ Sync PUSH Error:", error);
      throw error;
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
        // 1. Prepare Metadata (CPU Bound)
        const columns = getTableColumns(table);
        const dbToPropMapping: Record<string, string> = {};
        for (const [propName, col] of Object.entries(columns)) {
          dbToPropMapping[col.name] = propName;
        }

        // 2. Read Local Version (Read Operation - Fast)
        const versionQuery = await db
          .select({ version: table.version })
          .from(table)
          .orderBy(sql`${table.version} DESC`)
          .limit(1);

        const lastLocalVersion =
          (versionQuery[0] as { version: number } | undefined)?.version ?? 0;

        // 3. Fetch from Cloud (Network Bound)
        const result = await client.execute({
          sql: `SELECT * FROM ${name} WHERE version > ? ORDER BY version ASC`,
          args: [lastLocalVersion],
        });

        const rows = result.rows;
        if (rows.length === 0) continue;

        // 4. PREPARE DATA BEFORE TRANSACTION (Heavy Lifting)
        // 🔥 Robust Mapping using Turso ResultSet metadata
        const preparedRows = rows.map((row) => {
          const mappedRow: Record<string, unknown> = {};
          const rowData = row as Record<string, unknown>;

          result.columns.forEach((colName) => {
            const propName = dbToPropMapping[colName] || colName;
            mappedRow[propName] = normalizeSyncValue(
              rowData[colName],
              columns[propName],
            );
          });

          // Force syncStatus true karena ini data dari server
          return { ...mappedRow, syncStatus: true };
        });

        // 5. WRITE TO LOCAL DB (I/O Bound - Critical Section)
        // 🔥 Menggunakan Retry Mechanism untuk menghindari "Database Locked"
        await runTransactionWithRetry(db, async (tx) => {
          for (const rowData of preparedRows) {
            await tx
              .insert(table)
              .values(rowData as typeof table.$inferInsert)
              .onConflictDoUpdate({
                target: table.id,
                set: rowData as typeof table.$inferInsert,
              });
          }
        });

        totalUpdatedCount += rows.length;
      }
    } catch (error) {
      console.error(`❌ Sync PULL Error on table [${name}]:`, error);
      throw error;
    } finally {
      client.close();
    }

    return { success: true, count: totalUpdatedCount };
  },
};
