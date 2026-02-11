import { storeSettings, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { INITIAL_MIGRATION_SQL } from "./initial-sql";

// 👇 1. Infer Type Database dari fungsi getDb (No more 'any')
type DrizzleDB = ReturnType<typeof getDb>;

/**
 * 🛠️ CORE MIGRATION RUNNER
 * Hanya jalan jika Guard Clause mengizinkan (Fresh Install).
 */
async function runRawMigration(db: DrizzleDB) {
	console.log("🚀 Starting Fresh Migration...");

	const queries = INITIAL_MIGRATION_SQL.split("--> statement-breakpoint");

	for (const query of queries) {
		const cleanQuery = query.trim();
		if (!cleanQuery) continue;

		try {
			// Drizzle Proxy .run() menerima SQL raw
			await db.run(sql.raw(cleanQuery));
		} catch (error: unknown) {
			// 🛡️ Safe Error Handling (Narrowing Type)
			const errMessage =
				error instanceof Error
					? error.message
					: typeof error === "string"
						? error
						: JSON.stringify(error);

			// Double safety: Jika masih ada race condition, ignore error spesifik
			if (
				errMessage.includes("already exists") ||
				errMessage.includes("duplicate column")
			) {
				continue;
			}

			console.error("❌ Critical Migration Error on:", cleanQuery);
			throw error; // Lempar ke atas agar boot berhenti
		}
	}
	console.log("✅ Migration Logic Finished");
}

/**
 * 🌱 SEEDER RUNNER
 * Type-safe check & insert
 */
async function runSeeder(db: DrizzleDB) {
	// 1. Cek Admin
	const existingUser = await db.select().from(users).limit(1);

	if (existingUser.length === 0) {
		console.log("👤 Seeding Default Admin...");
		const hashedPassword = await bcrypt.hash("admin123", 10);

		await db.insert(users).values({
			id: uuidv7(),
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
			id: uuidv7(),
			name: "My Smart POS",
			currency: "IDR",
			address: "Indonesia",
		});
		console.log("✅ Store Settings Created");
	}
}

/**
 * 🚀 MAIN SETUP FUNCTION
 * Entry point yang dipanggil Page.tsx
 */
export const runSystemSetup = async () => {
	const db = getDb();
	console.log("🔄 Starting System Setup...");

	try {
		// 1️⃣ GUARD CLAUSE: Cek Tabel via Metadata SQLite
		// Ini cara paling valid untuk cek apakah DB sudah di-init
		// Kita gunakan `any` HANYA di hasil raw query karena return type proxy dinamis,
		// tapi logic kita tetap type-safe.
		const checkTable = await db.run(
			sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1;`,
		);

		// Cek apakah ada rows yang dikembalikan
		// (Proxy kita mengembalikan { rows: [...] })
		const rows = (checkTable as { rows?: unknown[] }).rows;
		const isInitialized = Array.isArray(rows) && rows.length > 0;

		if (isInitialized) {
			console.log("⏩ Database already initialized. Skipping migration.");
		} else {
			// 2️⃣ Fresh Install -> Jalankan CREATE TABLE
			console.log("⚡ Fresh install detected. Running Initial Migration...");
			await runRawMigration(db);
		}

		// 3️⃣ Seeding (Idempotent)
		await runSeeder(db);

		console.log("✅ System Setup Complete.");
		return { success: true, message: "System Ready" };
	} catch (error: unknown) {
		console.error("❌ Setup Critical Error:", error);
		// Re-throw dengan pesan jelas
		throw new Error(
			error instanceof Error ? error.message : "Unknown System Setup Error",
		);
	}
};
