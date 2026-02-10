// 👇 FIX 1: Tambahkan 'type' karena hanya dipakai sebagai definisi tipe parameter
import type Database from "@tauri-apps/plugin-sql";
import { INITIAL_SCHEMA } from "./initial-schema";

export async function runMigrations(db: Database) {
	console.log("🚀 Starting System Migration...");

	try {
		const statements = INITIAL_SCHEMA.split("--> statement-breakpoint");

		for (const statement of statements) {
			const sql = statement.trim();
			if (!sql) continue;

			try {
				await db.execute(sql);
			} catch (error: unknown) {
				// 👈 FIX 2: Ganti 'any' dengan 'unknown' (Standard 2026)
				// String(unknown) adalah operasi yang aman, jadi tidak perlu casting
				const msg = String(error).toLowerCase();

				if (
					msg.includes("already exists") ||
					msg.includes("duplicate column")
				) {
					continue;
				}

				console.error("❌ Critical SQL Error on:", sql);
				throw error;
			}
		}

		console.log("✅ Migration & Verification Finished Successfully.");
		return { status: "success" };
	} catch (error: unknown) {
		// 👈 FIX 3: Konsisten pakai 'unknown'
		console.error("❌ Migration Failed:", error);
		return { status: "error", message: String(error) };
	}
}
