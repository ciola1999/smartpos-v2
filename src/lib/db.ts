// smart-pos\src\lib\db.ts
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
		// Kita handle 'method' agar query efisien (Read vs Write)
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
					// Case: SELECT ('all', 'get', 'values')
					// Force cast ke any[] karena Tauri return unknown, tapi Drizzle butuh array
					const rows = (await sqlite.select(sql, params)) as any[];
					return { rows: rows };
				}
			} catch (e: any) {
				console.error("❌ SQL Error:", e.message);
				throw e;
			}
		});

		console.log("✅ Database initialized successfully");
		return db;
	} catch (error) {
		console.error("❌ Failed to initialize database:", error);
		throw error;
	}
};

export const getDb = () => {
	if (!db) throw new Error("Database not initialized! Call initDb() first.");
	return db;
};
