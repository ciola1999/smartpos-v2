import Database from "@tauri-apps/plugin-sql";
import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";

// 1. Definisikan Tipe untuk Baris Database Raw (dari Tauri Plugin)
// Tauri mengembalikan array of objects (Key-Value), bukan array of values.
type SqlRow = Record<string, unknown>;

// 2. Variabel Global dengan Tipe Eksplisit
let dbInstance: Database | null = null;
let drizzleInstance: SqliteRemoteDatabase | null = null;

export async function initDatabase() {
	// Return jika sudah ada instance (Singleton Pattern)
	if (dbInstance && drizzleInstance) {
		return { db: dbInstance, drizzle: drizzleInstance };
	}

	try {
		// Load Raw Database
		dbInstance = await Database.load("sqlite:store.db");

		// Setup Drizzle ORM Proxy
		drizzleInstance = drizzle(async (sql, params, method) => {
			try {
				// Pastikan dbInstance ada
				if (!dbInstance) throw new Error("Database instance lost");

				// Gunakan Generic <SqlRow[]> untuk memberi tahu TS bentuk return value-nya
				// params kita cast ke unknown[] agar aman
				const rows = await dbInstance.select<SqlRow[]>(
					sql,
					params as unknown[],
				);

				// Konversi: Array of Objects -> Array of Arrays
				// Drizzle Proxy membutuhkan format: [ [val1, val2], [val3, val4] ]
				return {
					rows: rows.map((row) => Object.values(row)),
				};
			} catch (e: unknown) {
				console.error("SQL Error:", e);
				// Return array kosong agar aplikasi tidak crash, tapi error tercatat
				return { rows: [] };
			}
		});

		console.log("✅ Database Connected Successfully");
		return { db: dbInstance, drizzle: drizzleInstance };
	} catch (error: unknown) {
		console.error("❌ Failed to load database:", error);
		throw error;
	}
}

// Helper strict untuk mengambil instance Drizzle
export function getDb(): SqliteRemoteDatabase {
	if (!drizzleInstance) {
		throw new Error("❌ Database not initialized! Call initDatabase() first.");
	}
	return drizzleInstance;
}
