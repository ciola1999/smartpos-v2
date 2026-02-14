import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { storeSettings, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { INITIAL_MIGRATION_SQL } from "./initial-sql";

type DrizzleDB = ReturnType<typeof getDb>;

const STORE_MAIN_ID = "STORE_MAIN";

/**
 * 🛠️ CORE MIGRATION RUNNER
 */
async function runRawMigration(db: DrizzleDB) {
	console.log("🚀 Starting Fresh Migration...");

	const queries = INITIAL_MIGRATION_SQL.split("--> statement-breakpoint");

	for (const query of queries) {
		const cleanQuery = query.trim();
		if (!cleanQuery) continue;

		try {
			await db.run(sql.raw(cleanQuery));
		} catch (error: unknown) {
			const errMessage =
				error instanceof Error
					? error.message
					: typeof error === "string"
						? error
						: JSON.stringify(error);

			if (
				errMessage.includes("already exists") ||
				errMessage.includes("duplicate column")
			) {
				continue;
			}

			console.error("❌ Migration Error on:", cleanQuery);
			throw error;
		}
	}
	console.log("✅ Migration Logic Finished");
}

/**
 * 🌱 SEEDER RUNNER (BULLETPROOF VERSION)
 * Menggunakan .onConflictDoNothing() agar tidak crash saat run berulang
 */
async function runSeeder(db: DrizzleDB) {
	const hashedPassword = await bcrypt.hash("admin123", 10);

	// --- 1. SEED USER ADMIN ---
	// Insert, jika username 'admin' sudah ada, SKIP otomatis (jangan error)
	await db
		.insert(users)
		.values({
			id: uuidv7(),
			name: "Super Admin",
			username: "admin",
			password: hashedPassword,
			role: "admin",
			isActive: true,
			version: 1,
			syncStatus: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.onConflictDoNothing({ target: users.username }); // 👈 KUNCI PERBAIKAN: Target kolom unique

	console.log("✅ Seeder: Admin check complete.");

	// --- 2. SEED STORE SETTINGS ---
	// Insert, jika ID sudah ada, SKIP otomatis
	await db
		.insert(storeSettings)
		.values({
			id: STORE_MAIN_ID,
			name: "My Smart POS",
			currency: "IDR",
			address: "Indonesia",
			version: 1,
			syncStatus: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.onConflictDoNothing({ target: storeSettings.id }); // 👈 Target Primary Key

	console.log("✅ Seeder: Store settings check complete.");
}

/**
 * 🚀 MAIN SETUP FUNCTION
 */
export const runSystemSetup = async () => {
	const db = getDb();
	console.log("🔄 Starting System Setup...");

	try {
		// 1️⃣ GUARD CLAUSE: Cek Tabel via Metadata SQLite
		const checkTable = await db.run(
			sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1;`,
		);

		const rows = (checkTable as { rows?: unknown[] }).rows;
		const isInitialized = Array.isArray(rows) && rows.length > 0;

		if (isInitialized) {
			console.log("⏩ Database tables detected. Skipping migration.");
		} else {
			console.log("⚡ Fresh install detected. Running Initial Migration...");
			await runRawMigration(db);
		}

		// 2️⃣ Seeder (Aman dijalankan berkali-kali)
		await runSeeder(db);

		console.log("✅ System Setup Complete.");
		return { success: true, message: "System Ready" };
	} catch (error: unknown) {
		console.error("❌ Setup Critical Error:", error);

		// Jangan throw error fatal hanya karena duplikat (safety net terakhir)
		const msg = error instanceof Error ? error.message : String(error);
		if (msg.includes("UNIQUE constraint failed")) {
			console.warn("⚠️ Ignored Unique Constraint Error during setup (Safe).");
			return { success: true, message: "System Ready (Recovered)" };
		}

		throw new Error(msg);
	}
};
