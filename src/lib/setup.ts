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
async function execMigrationStatement(db: DrizzleDB, query: string) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return;

  try {
    await db.run(sql.raw(cleanQuery));
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);

    if (
      errMessage.includes("already exists") ||
      errMessage.includes("duplicate column")
    ) {
      return;
    }
    throw error;
  }
}

async function runRawMigration(db: DrizzleDB) {
  const queries = INITIAL_MIGRATION_SQL.split("--> statement-breakpoint");
  for (const query of queries) {
    await execMigrationStatement(db, query);
  }
}

/**
 * 🌱 SEEDER RUNNER (BULLETPROOF VERSION)
 */
async function runSeeder(db: DrizzleDB) {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  // --- 1. SEED USER ADMIN ---
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
    .onConflictDoNothing({ target: users.username });

  // --- 2. SEED STORE SETTINGS ---
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
    .onConflictDoNothing({ target: storeSettings.id });
}

/**
 * 🚀 MAIN SETUP FUNCTION
 */
export const runSystemSetup = async () => {
  const db = getDb();

  try {
    // 1️⃣ GUARD CLAUSE: Cek Tabel via Metadata SQLite
    const checkTable = await db.run(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1;`,
    );

    const rows = (checkTable as { rows?: unknown[] }).rows;
    const isInitialized = Array.isArray(rows) && rows.length > 0;

    if (!isInitialized) {
      await runRawMigration(db);
    }

    // 2️⃣ Seeder (Aman dijalankan berkali-kali)
    await runSeeder(db);

    return { success: true, message: "System Ready" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("UNIQUE constraint failed")) {
      return { success: true, message: "System Ready (Recovered)" };
    }
    throw new Error(msg);
  }
};
