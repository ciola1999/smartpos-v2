import { storeSettings, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { INITIAL_MIGRATION_SQL } from "./initial-sql"; // Pastikan ini sudah berisi SQL UUID baru

/**
 * 🛠️ CORE MIGRATION RUNNER
 * Mengadaptasi logic lama Anda: Aman dijalankan berulang kali (Idempotent).
 */
async function runRawMigration(db: any) {
	console.log("🚀 Starting Safe Migration...");

	// Split query dari Drizzle Kit output
	const queries = INITIAL_MIGRATION_SQL.split("--> statement-breakpoint");

	for (const query of queries) {
		const cleanQuery = query.trim();
		if (!cleanQuery) continue;

		try {
			// Eksekusi Raw SQL
			await db.run(sql.raw(cleanQuery));
		} catch (error: unknown) {
			// 👇 LOGIC LAMA ANDA (DIPERTAHANKAN)
			// Kita ignore error jika tabel/kolom sudah ada
			const msg = String(error).toLowerCase();
			if (
				msg.includes("already exists") ||
				msg.includes("duplicate column") ||
				msg.includes("unique constraint")
			) {
				// Skip, anggap sukses (Idempotent)
				continue;
			}

			console.error("❌ Critical Migration Error on:", cleanQuery);
			throw error;
		}
	}
	console.log("✅ Migration Logic Finished");
}

/**
 * 🌱 SEEDER RUNNER
 * Membuat data awal jika belum ada
 */
async function runSeeder(db: any) {
	// 1. Cek Admin
	const existingUser = await db.select().from(users).limit(1);
	if (existingUser.length === 0) {
		console.log("👤 Seeding Default Admin...");
		const hashedPassword = await bcrypt.hash("admin123", 10);

		await db.insert(users).values({
			id: uuidv7(), // UUID v7
			name: "Super Admin",
			username: "admin",
			password: hashedPassword,
			role: "admin",
			isActive: true,
		});
		console.log("✅ Admin Created");
	}

	// 2. Cek Store Settings
	const existingSettings = await db.select().from(storeSettings).limit(1);
	if (existingSettings.length === 0) {
		console.log("🏪 Seeding Store Settings...");
		await db.insert(storeSettings).values({
			id: uuidv7(), // UUID v7
			name: "My Smart POS",
			currency: "IDR",
			address: "Indonesia",
		});
		console.log("✅ Store Settings Created");
	}
}

/**
 * 🚀 MAIN SETUP FUNCTION
 * Dipanggil di page.tsx saat aplikasi start
 */
export async function runSystemSetup() {
	const db = getDb();

	try {
		// 1. Jalankan Migrasi Struktur Tabel
		await runRawMigration(db);

		// 2. Jalankan Seeding Data Awal
		await runSeeder(db);

		return { success: true, message: "System Ready" };
	} catch (error: any) {
		console.error("❌ Setup Critical Error:", error);
		throw error;
	}
}
