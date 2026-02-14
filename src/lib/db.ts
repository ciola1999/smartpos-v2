import * as schema from "@/db/schema"; // 🔥 WAJIB IMPORT SCHEMA
import Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";

// Definisikan Tipe DB agar TypeScript tau struktur tabel kita
export type TauriDB = ReturnType<typeof drizzle<typeof schema>>;

// Singleton Connection
let db: TauriDB | null = null;

export const initDb = async (): Promise<TauriDB> => {
	if (db) return db;

	try {
		// 1. Load SQLite DB (Lokasi file ada di AppData OS)
		const sqlite = await Database.load("sqlite:smartpos.db");

		// 2. Setup Drizzle Proxy
		// 🔥 Masukkan { schema } sebagai argumen kedua!
		db = drizzle(
			async (sql, params, method) => {
				try {
					if (method === "run") {
						// Untuk Insert/Update/Delete, Drizzle butuh return object spesifik
						const res = await sqlite.execute(sql, params);
						return {
							rows: [],
							rowsAffected: res.rowsAffected,
							insertId: res.lastInsertId,
						};
					}

					// Untuk Select
					const rows = await sqlite.select(sql, params);

					// 🔍 DIAGNOSTIC LOG (TEMPORARY)
					if (sql.includes("FROM `users`")) {
						console.log("[DB Proxy] Raw rows for users table:", rows);
					}

					return { rows: rows as unknown[] }; // Strict type casting
				} catch (e: unknown) {
					const errorMessage =
						e instanceof Error
							? e.message
							: typeof e === "string"
								? e
								: JSON.stringify(e);

					console.error("❌ SQL Error:", errorMessage);
					throw new Error(errorMessage);
				}
			},
			{ schema }, // 🔥 KRUSIAL: Agar db.query... bisa dipakai
		);

		console.log("✅ Database initialized successfully");
		return db;
	} catch (error) {
		console.error("❌ Failed to initialize database:", error);
		throw error;
	}
};

// Helper sync untuk mengambil instance yang SUDAH init
export const getDb = (): TauriDB => {
	if (!db) {
		throw new Error(
			"Database not initialized! Call initDb() first in your app entry point.",
		);
	}
	return db;
};
