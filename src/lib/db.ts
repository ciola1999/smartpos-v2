import Database from "@tauri-apps/plugin-sql";
import { getTableColumns } from "drizzle-orm";
import type {
  SQLiteColumn,
  SQLiteTableWithColumns,
} from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "@/db/schema";

// 1️⃣ Definisi Type yang Kuat (Penting untuk Service lain)
// Kita ambil tipe return dari fungsi drizzle() secara langsung
const dummyDb = drizzle(async () => ({ rows: [] }), { schema });
export type LocalDB = typeof dummyDb;

let db: LocalDB | null = null;

/**
 * 🛠️ Konversi object row ke array of values.
 * Drizzle Proxy (sqlite-proxy) mengharuskan return format array [val1, val2, ...].
 * Tauri SQL plugin mengembalikan object { col1: val1, col2: val2 }.
 */
function rowObjectToArray(row: Record<string, unknown>): unknown[] {
  return Object.values(row);
}

/**
 * Membersihkan error message dari Tauri SQL plugin.
 * Menghapus wrapper JSON string ganda yang sering muncul.
 */
function cleanErrorMessage(e: unknown): string {
  let msg =
    e instanceof Error
      ? e.message
      : typeof e === "string"
        ? e
        : JSON.stringify(e);

  // Bersihkan kutip ganda berlebih jika ada
  if (msg.startsWith('"') && msg.endsWith('"') && msg.length > 1) {
    try {
      msg = JSON.parse(msg);
    } catch {
      msg = msg.slice(1, -1);
    }
  }
  return msg;
}

export const initDb = async (): Promise<LocalDB> => {
  if (db) return db;

  try {
    // Load Database
    const sqlite = await Database.load("sqlite:smartpos.db");

    // 🔥 WAJIB: Performance & Concurrency Tuning
    await sqlite.execute("PRAGMA journal_mode=WAL;"); // Biar UI tidak nge-freeze pas sync
    await sqlite.execute("PRAGMA synchronous=NORMAL;");
    await sqlite.execute("PRAGMA foreign_keys=ON;");
    await sqlite.execute("PRAGMA busy_timeout=5000;"); // 🆕 Tunggu 5 detik sebelum throw "Database Locked"

    // --- 🟢 REPAIR SCHEMA (Auto-Migration) ---
    // Cek apakah ada kolom baru di schema.ts tapi belum ada di smartpos.db
    await repairSchema(sqlite);

    db = drizzle(
      async (sql, params, method) => {
        return await handleSqlQuery(sqlite, sql, params, method);
      },
      { schema },
    );

    return db;
  } catch (error) {
    // Re-throw dengan pesan yang deskriptif
    throw new Error(
      `Database Initialization Failed: ${cleanErrorMessage(error)}`,
    );
  }
};

/**
 * 🛰️ Handle SQL Query (Logic Isolation)
 * Memproses query dari Drizzle Proxy ke Tauri SQL Plugin.
 */
async function handleSqlQuery(
  sqlite: Database,
  sql: string,
  params: unknown[],
  method: "run" | "all" | "get" | "values",
) {
  try {
    const trimmedSql = sql.trimStart().toLowerCase();

    // Robust handling for Transaction control SQLs
    if (
      trimmedSql === "begin" ||
      trimmedSql === "commit" ||
      trimmedSql === "rollback"
    ) {
      try {
        await sqlite.execute(sql, params);
      } catch (e) {
        const msg = cleanErrorMessage(e);
        if (msg.includes("no transaction is active")) {
          return { rows: [] };
        }
        throw e;
      }
      return { rows: [] };
    }

    const isWriteWithReturning =
      (trimmedSql.startsWith("insert") ||
        trimmedSql.startsWith("update") ||
        trimmedSql.startsWith("delete")) &&
      trimmedSql.includes("returning");

    if (method === "run" && !isWriteWithReturning) {
      const res = await sqlite.execute(sql, params);
      return {
        rows: [] as unknown[][],
        rowsAffected: res.rowsAffected,
        insertId: res.lastInsertId,
      };
    }

    const rawRows = await sqlite.select<Record<string, unknown>[]>(sql, params);
    return { rows: rawRows.map(rowObjectToArray) };
  } catch (e: unknown) {
    const errorMessage = cleanErrorMessage(e);
    if (errorMessage.includes("cannot rollback - no transaction is active")) {
      return { rows: [] };
    }
    throw new Error(
      `[SQL_ERROR] ${errorMessage} | Query: ${sql.substring(0, 50)}...`,
    );
  }
}

/**
 * 🛠️ REPAIR SCHEMA (Auto-Migration)
 * Menambahkan kolom yang hilang secara otomatis ke SQLite lokal.
 */
async function repairSchema(sqlite: Database) {
  try {
    const tableEntries = Object.entries(schema);

    for (const [tableName, table] of tableEntries) {
      if (!table || typeof table !== "object" || !("id" in table)) continue;

      // Ambil info kolom yang ada di DB saat ini
      // Gunakan casting ke any hanya jika perlu untuk plugin SQL Tauri yang kadang type definitions-nya bermasalah di versi tertentu
      const tableInfo = await sqlite.select<Array<{ name: string }>>(
        `PRAGMA table_info("${tableName}")`,
      );

      if (!tableInfo || tableInfo.length === 0) continue;

      const existingColumns = new Set(tableInfo.map((c) => c.name));

      // Gunakan getTableColumns untuk mendapatkan metadata kolom secara resmi dari Drizzle
      const drizzleColumns = getTableColumns(
        table as unknown as SQLiteTableWithColumns<{
          name: string;
          schema: string | undefined;
          columns: Record<string, SQLiteColumn<any, any, any>>;
          dialect: "sqlite";
        }>,
      );

      for (const column of Object.values(drizzleColumns)) {
        const colName = column.name;
        if (!colName || existingColumns.has(colName)) continue;

        const sqlDataType: string =
          (column as { getSQLType: () => string }).getSQLType() || "TEXT";

        await sqlite.execute(
          `ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${sqlDataType}`,
        );
      }
    }
  } catch (err) {
    throw new Error(`Schema repair failed: ${cleanErrorMessage(err)}`);
  }
}

// Helper sync untuk mendapatkan instance (harus dipastikan initDb sudah dipanggil sebelumnya di main)
export const getDb = (): LocalDB => {
  if (!db) {
    throw new Error(
      "Database not initialized! Call initDb() first in your app entry point.",
    );
  }
  return db;
};
