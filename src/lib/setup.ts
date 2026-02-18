import bcrypt from "bcryptjs"; // Pastikan install: bun add bcryptjs @types/bcryptjs
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";

// -----------------------------------------------------------------------------
// 🛠️ HELPER: ERROR CLEANER
// -----------------------------------------------------------------------------
function cleanError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// -----------------------------------------------------------------------------
// 🚀 MAIN SETUP FUNCTION
// -----------------------------------------------------------------------------
export const runSystemSetup = async () => {
  console.log("🚀 [SETUP] Starting system integrity check...");

  try {
    // Ambil instance DB yang sudah di-init di db.ts
    const db = getDb();

    // -------------------------------------------------------------------------
    // 1. SMOKE TEST: Cek Ketersediaan Tabel
    // -------------------------------------------------------------------------
    try {
      // Kita coba select 1 baris dari tabel settings untuk memastikan tabel ada
      await db.select().from(schema.storeSettings).limit(1);
    } catch (error) {
      const msg = cleanError(error);
      if (msg.includes("no such table")) {
        console.warn(
          "⚠️ [SETUP] Tables not found. Waiting for Auto-Repair or Drizzle Kit...",
        );
        // Jangan throw error fatal, biarkan db.ts repairSchema bekerja di background
        // atau return false agar UI bisa menampilkan loading state.
        return { success: false, message: "Tables syncing..." };
      }
      throw error;
    }

    // -------------------------------------------------------------------------
    // 2. SEED: STORE SETTINGS (Idempotent)
    // -------------------------------------------------------------------------
    // Cek apakah settings sudah ada?
    const existingSettings = await db
      .select()
      .from(schema.storeSettings)
      .limit(1);

    if (existingSettings.length === 0) {
      console.log("📦 [SETUP] Seeding Default Store Settings...");

      const now = new Date();
      await db
        .insert(schema.storeSettings)
        .values({
          id: "STORE_MAIN", // Hardcoded ID untuk Single Store
          name: "Smart POS Store",
          address: "Lokasi Toko",
          phone: "-",
          syncStatus: false,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }

    // -------------------------------------------------------------------------
    // 3. SEED: ADMIN USER (Idempotent)
    // -------------------------------------------------------------------------
    // Cek apakah ada user dengan role admin?
    const adminExists = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, "admin"))
      .limit(1);

    if (adminExists.length === 0) {
      console.log("👤 [SETUP] Creating Super Admin...");

      const hashedPassword = await bcrypt.hash("admin123", 10);
      const now = new Date();

      await db
        .insert(schema.users)
        .values({
          id: uuidv7(),
          name: "Super Admin",
          username: "admin", // Required field
          email: "admin@pos.local",
          password: hashedPassword,
          role: "admin",
          syncStatus: false,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }

    // -------------------------------------------------------------------------
    // 4. SEED: DEFAULT CATEGORY (Optional but Recommended)
    // -------------------------------------------------------------------------
    await db
      .insert(schema.categories)
      .values({
        id: "CAT_DEFAULT",
        name: "Umum",
        slug: "umum",
        description: "Kategori Default",
        syncStatus: false,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing(); // Skip jika sudah ada

    console.log("✅ [SETUP] System Integrity Verified.");
    return { success: true, message: "System Ready" };
  } catch (error) {
    const msg = cleanError(error);
    console.error("❌ [SETUP_FATAL]", msg);

    // Jangan crash app total, tapi beritahu UI ada masalah
    return { success: false, message: `Setup Failed: ${msg}` };
  }
};
