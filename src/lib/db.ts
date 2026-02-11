import Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";

// Singleton Connection
let db: ReturnType<typeof drizzle> | null = null;

export const initDb = async () => {
	if (db) return db;

	try {
		// 1. Load SQLite DB
		const sqlite = await Database.load("sqlite:smartpos.db");

		// 2. Setup Drizzle Proxy (Bridge Tauri <-> Drizzle)
		db = drizzle(async (sql, params, method) => {
			try {
				// LOGIC: Pisahkan Read (select) vs Write (execute)
				if (method === "run") {
					// Case: INSERT, UPDATE, DELETE
					const res = await sqlite.execute(sql, params);
					return {
						rows: [],
						rowsAffected: res.rowsAffected,
						insertId: res.lastInsertId,
					};
				} else {
					// Case: SELECT
					// Gunakan 'unknown[]' bukan 'any[]' untuk mematuhi aturan strict mode
					// Drizzle akan memproses mapping tipe datanya nanti
					const rows = (await sqlite.select(sql, params)) as unknown[];
					return { rows: rows };
				}
			} catch (e: unknown) {
				// 🛡️ STRICT ERROR HANDLING
				// Kita tangkap error dalam bentuk apa pun (String/Error Object)
				const errorMessage =
					e instanceof Error
						? e.message
						: typeof e === "string"
							? e
							: JSON.stringify(e);

				console.error("❌ SQL Execution Failed");
				console.error("👉 Query:", sql);
				console.error("👉 Params:", params);
				console.error("👉 Error:", errorMessage);

				// Re-throw sebagai Error object standar agar setup.ts bisa menangkapnya
				throw new Error(errorMessage);
			}
		});

		console.log("✅ Database initialized successfully");
		return db;
	} catch (error) {
		console.error("❌ Failed to initialize database wrapper:", error);
		throw error;
	}
};

export const getDb = () => {
	if (!db) throw new Error("Database not initialized! Call initDb() first.");
	return db;
};
