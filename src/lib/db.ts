import { createClient } from "@libsql/client";
import Database from "@tauri-apps/plugin-sql";
import { getTableColumns, getTableName, type TableConfig } from "drizzle-orm";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "@/db/schema";
import { INITIAL_SQL_STATEMENTS } from "./initial-sql";

// -----------------------------------------------------------------------------
// 1️⃣ STRICT TYPE DEFINITIONS & INTERFACES
// -----------------------------------------------------------------------------

interface IntrospectableColumn {
  name: string;
  notNull: boolean;
  default: unknown;
  getSQLType: () => string;
}

interface DrizzleTableLike {
  $inferSelect: unknown;
  $inferInsert: unknown;
  getSQL: () => unknown;
  _: {
    name: string;
    columns: Record<string, unknown>;
    config: TableConfig;
  };
}

// -----------------------------------------------------------------------------
// 2️⃣ GLOBAL INSTANCES
// -----------------------------------------------------------------------------

const dummyDb = drizzle(async () => ({ rows: [] }), { schema });
export type LocalDB = typeof dummyDb;

let db: LocalDB | null = null;

const cloudUrl =
  process.env.DATABASE_TURSO_DATABASE_URL ||
  process.env.NEXT_PUBLIC_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "";
const cloudAuth =
  process.env.DATABASE_TURSO_AUTH_TOKEN ||
  process.env.NEXT_PUBLIC_DATABASE_AUTH_TOKEN ||
  process.env.DATABASE_AUTH_TOKEN ||
  "";

export const client = createClient({
  url: cloudUrl.startsWith("libsql")
    ? cloudUrl
    : "libsql://placeholder-url.turso.io",
  authToken: cloudAuth,
});

// -----------------------------------------------------------------------------
// 3️⃣ TYPE GUARDS (UTILITIES)
// -----------------------------------------------------------------------------

function isTable(value: unknown): value is SQLiteTableWithColumns<TableConfig> {
  return (
    typeof value === "object" &&
    value !== null &&
    "_" in value &&
    typeof (value as DrizzleTableLike)._ === "object" &&
    "name" in (value as DrizzleTableLike)._ &&
    "columns" in (value as DrizzleTableLike)._
  );
}

function isIntrospectableColumn(value: unknown): value is IntrospectableColumn {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "getSQLType" in value &&
    typeof (value as IntrospectableColumn).getSQLType === "function"
  );
}

function rowObjectToArray(row: Record<string, unknown>): unknown[] {
  return Object.values(row);
}

function cleanErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("{") || msg.startsWith('"')) {
    try {
      const parsed = JSON.parse(msg);
      return typeof parsed === "object" && parsed.message
        ? parsed.message
        : String(parsed);
    } catch {
      // ignore parse error
    }
  }
  return msg;
}

// -----------------------------------------------------------------------------
// 4️⃣ CORE LOGIC: INIT & PROXY
// -----------------------------------------------------------------------------

export const initDb = async (): Promise<LocalDB> => {
  if (db) return db;

  try {
    // 1. Load Tauri SQL Plugin
    const sqlite = await Database.load("sqlite:smartpos.db");

    // 2. Performance Tuning (PRAGMA 2026 Standard)
    await sqlite.execute("PRAGMA journal_mode=WAL;");
    await sqlite.execute("PRAGMA synchronous=NORMAL;");
    await sqlite.execute("PRAGMA foreign_keys=ON;");
    await sqlite.execute("PRAGMA busy_timeout=5000;");
    await sqlite.execute("PRAGMA temp_store=MEMORY;");

    // 3. Batch Create Tables (If not exist)
    console.log("🛠️ [DB] Running initial schema setup...");
    await executeInitialSchema(sqlite);

    // 4. Auto-repair schema (add missing columns, drop orphaned columns)
    await repairSchema(sqlite);

    // 4. Verification Check: Pasikan tabel krusial ada (Check AFTER repair)
    const tables = await sqlite.select<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'store_settings')",
    );
    if (tables.length < 2) {
      throw new Error(
        `Critical tables missing after init. Found: ${tables.map((t) => t.name).join(", ")}`,
      );
    }

    // 5. Hotfixes (Manual Patch for stubborn tables)
    await runHotfixes(sqlite);

    // 6. Auto-repair schema (General)
    await repairSchema(sqlite);

    // 7. Init Drizzle Proxy
    db = drizzle(
      async (sql, params, method) => {
        try {
          return await handleSqlQuery(sqlite, sql, params, method);
        } catch (e) {
          console.error(`[DB_ERROR] Query: ${sql}`, e);
          throw e;
        }
      },
      { schema },
    );

    console.log("✅ [DB] Database initialized successfully.");
    return db;
  } catch (error) {
    const msg = cleanErrorMessage(error);
    console.error("❌ [DB_FATAL] Init Failed:", msg);
    throw new Error(msg);
  }
};

export const getDb = (): LocalDB => {
  if (!db) {
    throw new Error("Database not initialized! Call await initDb() first.");
  }
  return db;
};

// -----------------------------------------------------------------------------
// 5️⃣ INITIAL SCHEMA EXECUTION
// -----------------------------------------------------------------------------

/**
 * Menjalankan setiap statement dari INITIAL_SQL_STATEMENTS secara independen.
 * Jika satu statement gagal (misal tabel sudah ada), log warning & lanjutkan.
 */
async function executeInitialSchema(sqlite: Database): Promise<void> {
  let successCount = 0;
  let skipCount = 0;

  for (const statement of INITIAL_SQL_STATEMENTS) {
    try {
      await sqlite.execute(statement);
      successCount++;
    } catch (err) {
      const msg = cleanErrorMessage(err);
      if (msg.toLowerCase().includes("already exists")) {
        skipCount++;
      } else {
        console.error(
          `[DB_INIT] Statement FAIL: ${msg}\nSQL: ${statement.substring(0, 100)}...`,
        );
      }
    }
  }

  console.log(
    `🛠️ [DB] Schema setup done: ${successCount} executed, ${skipCount} skipped.`,
  );
}

// -----------------------------------------------------------------------------
// 6️⃣ QUERY HANDLER (THE BRIDGE)
// -----------------------------------------------------------------------------

async function handleSqlQuery(
  sqlite: Database,
  sql: string,
  params: unknown[],
  method: "run" | "all" | "get" | "values",
) {
  const trimmedSql = sql.trim().toLowerCase();

  // Transaction Handling (Explicit)
  if (
    trimmedSql === "begin" ||
    trimmedSql === "commit" ||
    trimmedSql === "rollback"
  ) {
    await sqlite.execute(sql);
    return { rows: [] };
  }

  // Write with Returning Handling
  const isWriteWithReturning =
    ["insert", "update", "delete"].some((cmd) => trimmedSql.startsWith(cmd)) &&
    trimmedSql.includes("returning");

  // A. Handle "run" (Write only)
  if (method === "run" && !isWriteWithReturning) {
    const res = await sqlite.execute(sql, params);
    return {
      rows: [],
      rowsAffected: res.rowsAffected,
      insertId: res.lastInsertId,
    };
  }

  // B. Handle "read" or "write+returning"
  const rawRows = await sqlite.select<Record<string, unknown>[]>(sql, params);
  const rows = rawRows.map((row) => rowObjectToArray(row));

  return { rows };
}

// -----------------------------------------------------------------------------
// 7️⃣ SCHEMA REPAIR (AUTO-MIGRATION)
// -----------------------------------------------------------------------------

/**
 * Menambah kolom baru yang ada di Drizzle tapi belum ada di DB,
 * dan menghapus kolom lama yang sudah tidak ada di Drizzle.
 */
/**
 * Memperbaiki kolom pada tabel tertentu (Add/Drop/Sync)
 */
async function repairTable(sqlite: Database, table: DrizzleTableLike) {
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle cast
  const tableName = getTableName(table as any);

  // Cek keberadaan tabel via sqlite_master untuk menghindari error 'no such table' pada PRAGMA
  const existing = await sqlite.select<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [tableName],
  );

  if (!existing || existing.length === 0) {
    console.warn(
      `[DB_MIGRATE] Skip repair: table "${tableName}" does not exist yet.`,
    );
    return;
  }

  const tableInfo = await sqlite.select<Array<{ name: string; type: string }>>(
    `PRAGMA table_info("${tableName}")`,
  );

  const dbColumnMap = new Map(tableInfo.map((c) => [c.name, c.type]));
  // biome-ignore lint/suspicious/noExplicitAny: Drizzle cast
  const drizzleColumns = getTableColumns(table as any);
  const drizzleColumnNames = new Set<string>();

  // 1. Sync Columns
  for (const column of Object.values(drizzleColumns)) {
    if (!isIntrospectableColumn(column)) continue;
    drizzleColumnNames.add(column.name);

    const dbType = dbColumnMap.get(column.name);
    if (!dbType) {
      await addMissingColumn(sqlite, tableName, column);
    } else {
      checkTypeMismatch(tableName, column, dbType);
    }
  }

  // 2. Cleanup orphaned columns
  await dropOrphanedColumns(sqlite, tableName, dbColumnMap, drizzleColumnNames);
}

/**
 * Helper: Hapus kolom yang tidak ada di skema
 */
async function dropOrphanedColumns(
  sqlite: Database,
  tableName: string,
  dbColumnMap: Map<string, string>,
  drizzleColumnNames: Set<string>,
) {
  for (const [colName] of dbColumnMap) {
    if (drizzleColumnNames.has(colName)) continue;

    console.warn(
      `[DB_MIGRATE] Dropping orphaned column: ${tableName}.${colName}`,
    );
    try {
      await sqlite.execute(
        `ALTER TABLE "${tableName}" DROP COLUMN "${colName}"`,
      );
    } catch (_err) {
      console.warn(
        `[DB_MIGRATE] Cannot drop ${colName}: plugin might not support DROP COLUMN yet.`,
      );
    }
  }
}

/**
 * ALTER TABLE → ADD COLUMN dengan default value handling.
 */
async function addMissingColumn(
  sqlite: Database,
  tableName: string,
  column: IntrospectableColumn,
): Promise<void> {
  console.log(`[DB_MIGRATE] Adding column: ${tableName}.${column.name}`);

  const colType = column.getSQLType();
  let columnDef = `ADD COLUMN "${column.name}" ${colType}`;

  if (column.default !== undefined && column.default !== null) {
    const val = column.default;
    const safeVal =
      typeof val === "string" && !val.includes("(") ? `'${val}'` : String(val);

    columnDef += ` DEFAULT ${safeVal}`;

    // SQLite: NOT NULL allowed on new columns only with DEFAULT
    if (column.notNull) {
      columnDef += " NOT NULL";
    }
  }

  await sqlite.execute(`ALTER TABLE "${tableName}" ${columnDef}`);
}

/**
 * Log warning jika tipe data di DB tidak cocok dengan definisi Drizzle.
 */
function checkTypeMismatch(
  tableName: string,
  column: IntrospectableColumn,
  dbType: string,
): void {
  const drizzleType = column.getSQLType().toLowerCase();
  const dbTypeLower = dbType.toLowerCase();

  // SQLite is flexible with types, but log mismatches for awareness
  if (
    !dbTypeLower.includes(drizzleType) &&
    !drizzleType.includes(dbTypeLower)
  ) {
    console.warn(
      `[DB_MIGRATE] Type mismatch: ${tableName}.${column.name} → DB="${dbType}", Schema="${drizzleType}"`,
    );
  }
}

/**
 * Orchestrator: perbaiki semua tabel, lalu cleanup tabel orphan.
 */
async function repairSchema(sqlite: Database): Promise<void> {
  try {
    const definedTables = new Set<string>();

    // 1. Repair each schema-defined table
    for (const value of Object.values(schema)) {
      if (!isTable(value)) continue;

      try {
        const tableName = getTableName(value);
        definedTables.add(tableName);
        await repairTable(sqlite, value as unknown as DrizzleTableLike);
      } catch (tableErr) {
        console.warn(
          `[DB_MIGRATE] Failed to repair a table but continuing:`,
          cleanErrorMessage(tableErr),
        );
      }
    }

    // 2. Drop orphaned tables not in schema
    try {
      const tablesInDb = await sqlite.select<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      );

      for (const row of tablesInDb) {
        if (definedTables.has(row.name)) continue;

        // DEBUG: Logging to see why store_settings is considered orphaned
        console.warn(`[DB_MIGRATE] Orphaned table detected: ${row.name}`);
        console.log(
          `[DB_DEBUG] Defined Tables: ${Array.from(definedTables).join(", ")}`,
        );

        // DISABLED FOR SAFETY:
        // await sqlite.execute(`DROP TABLE IF EXISTS "${row.name}"`);
      }
    } catch (cleanupErr) {
      console.warn(
        `[DB_MIGRATE] Cleanup failed but continuing:`,
        cleanErrorMessage(cleanupErr),
      );
    }

    console.log("✅ [DB_MIGRATE] Schema check completed.");
  } catch (err) {
    console.error(
      "⚠️ [DB_MIGRATE] Critical failure in repairSchema:",
      cleanErrorMessage(err),
    );
  }
}

/**
 * 🩹 Hotfixes: Patch khusus untuk masalah migrasi yang bandel
 * Jalankan ini sebelum repairSchema auto.
 */
async function runHotfixes(sqlite: Database) {
  // 1. Force Add order_items columns (sync_status, version, timestamps)
  // Gunakan try-catch per kolom karena 'ADD COLUMN IF NOT EXISTS' tidak didukung di semua versi SQLite
  const orderItemCols = [
    { name: "sync_status", type: "INTEGER DEFAULT 0 NOT NULL" },
    { name: "version", type: "INTEGER DEFAULT 1 NOT NULL" },
    {
      name: "created_at",
      type: "INTEGER DEFAULT (strftime('%s', 'now') * 1000) NOT NULL",
    },
    {
      name: "updated_at",
      type: "INTEGER DEFAULT (strftime('%s', 'now') * 1000) NOT NULL",
    },
    { name: "deleted_at", type: "INTEGER" },
  ];

  for (const col of orderItemCols) {
    try {
      await sqlite.execute(
        `ALTER TABLE "order_items" ADD COLUMN "${col.name}" ${col.type}`,
      );
      console.log(`🩹 [HOTFIX] Added missing column: order_items.${col.name}`);
    } catch (e: unknown) {
      // Ignore "duplicate column name" error (Silent success)
      const msg = String(e).toLowerCase();
      if (!msg.includes("duplicate column")) {
        // console.warn(`[HOTFIX] Warning adding ${col.name}:`, msg);
      }
    }
  }
}
