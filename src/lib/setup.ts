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
        return { success: false, message: "Tables syncing..." };
      }
      throw error;
    }

    // -------------------------------------------------------------------------
    // 2. SEED: STORE SETTINGS (Idempotent)
    // -------------------------------------------------------------------------
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
          id: "STORE_MAIN",
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
    // 3. SEED: DEFAULT BRANCH (Idempotent) — WAJIB ada sebelum seeding lainnya
    // -------------------------------------------------------------------------
    const branchExists = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.id, "BRANCH_MAIN"))
      .limit(1);

    if (branchExists.length === 0) {
      console.log("🏪 [SETUP] Seeding Default Branch...");
      const now = new Date();
      await db
        .insert(schema.branches)
        .values({
          id: "BRANCH_MAIN",
          code: "HQ-001",
          name: "Toko Pusat",
          address: "Lokasi Toko",
          city: "Jakarta",
          country: "Indonesia",
          isHeadquarters: true,
          timezone: "Asia/Jakarta",
          syncStatus: false,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }

    // -------------------------------------------------------------------------
    // 4. SEED: DEFAULT WAREHOUSE (Idempotent)
    // -------------------------------------------------------------------------
    const warehouseExists = await db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.id, "WH_MAIN"))
      .limit(1);

    if (warehouseExists.length === 0) {
      console.log("🏭 [SETUP] Seeding Default Warehouse...");
      const now = new Date();
      await db
        .insert(schema.warehouses)
        .values({
          id: "WH_MAIN",
          branchId: "BRANCH_MAIN",
          code: "WH-001",
          name: "Gudang Utama",
          isActive: true,
          syncStatus: false,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }

    // -------------------------------------------------------------------------
    // 5. SEED: ADMIN USER (Idempotent)
    // -------------------------------------------------------------------------
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
          branchId: "BRANCH_MAIN",
          name: "Super Admin",
          username: "admin",
          email: "admin@pos.local",
          password: hashedPassword,
          role: "admin",
          syncStatus: false,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    } else if (adminExists[0] && !adminExists[0].branchId) {
      // Pastikan admin sudah terhubung ke branch default
      await db
        .update(schema.users)
        .set({ branchId: "BRANCH_MAIN" })
        .where(eq(schema.users.id, adminExists[0].id));
    }

    // -------------------------------------------------------------------------
    // 6. SEED: DEFAULT CATEGORY (Idempotent)
    // -------------------------------------------------------------------------
    await db
      .insert(schema.categories)
      .values({
        id: "CAT_DEFAULT",
        branchId: "BRANCH_MAIN",
        name: "Umum",
        slug: "umum",
        description: "Kategori Default",
        syncStatus: false,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    console.log("✅ [SETUP] System Integrity Verified.");
    return { success: true, message: "System Ready" };
  } catch (error) {
    const msg = cleanError(error);
    console.error("❌ [SETUP_FATAL]", msg);
    return { success: false, message: `Setup Failed: ${msg}` };
  }
};

// -----------------------------------------------------------------------------
// 🔑 SESSION LOADER: Baca data sesi dari DB untuk mengisi Zustand store
// -----------------------------------------------------------------------------
export interface SessionData {
  branchId: string;
  warehouseId: string;
  userId: string;
  userName: string;
}

/**
 * Membaca branch pertama (prioritaskan HQ) dan user admin dari DB.
 * Dipanggil oleh TauriProvider setelah initDb() + runSystemSetup()
 * untuk mengisi useSessionStore secara otomatis.
 */
export const loadSessionData = async (): Promise<SessionData | null> => {
  try {
    const db = getDb();

    // Ambil branch HQ atau branch pertama yang ada
    const branches = await db
      .select()
      .from(schema.branches)
      .orderBy(schema.branches.isHeadquarters)
      .limit(1);

    if (branches.length === 0) {
      console.warn("[SESSION] No branch found in DB.");
      return null;
    }

    const branch = branches[0];

    // Ambil warehouse default untuk branch ini
    const warehouses = await db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.branchId, branch.id))
      .limit(1);

    const warehouseId = warehouses[0]?.id ?? "WH_MAIN";

    // Ambil user admin yang aktif
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, "admin"))
      .limit(1);

    const user = users[0];
    if (!user) {
      console.warn("[SESSION] No admin user found in DB.");
      return null;
    }

    return {
      branchId: branch.id,
      warehouseId,
      userId: user.id,
      userName: user.name,
    };
  } catch (e) {
    console.error("[SESSION] Failed to load session data:", e);
    return null;
  }
};
