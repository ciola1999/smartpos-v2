import { and, desc, eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import * as schema from "@/db/schema";
import { getDb, runTransactionWithRetry } from "@/lib/db";

// 🔌 TAURI INTEROP (Dynamic Import untuk Hybrid App)
// Mencegah error saat dijalankan di server-side Next.js, tapi aktif di Desktop.
const isTauri = () => typeof window !== "undefined" && "__TAURI__" in window;

async function invokeTauri(command: string, args: Record<string, any> = {}) {
  if (!isTauri()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(command, args);
  } catch (e) {
    console.warn(`[Tauri] Gagal invoke ${command}:`, e);
  }
}

// --- 1. VALIDATION SCHEMAS (STRICT ZOD) ---

// Enum ini harus match persis dengan kolom 'type' di database
const movementTypeSchema = z.enum([
  "sale",
  "purchase",
  "return",
  "adjustment",
  "transfer",
  "damage",
  "void",
  "production",
]);

export const adjustStockSchema = z
  .object({
    // ✅ Support Produk ATAU Bahan Baku (Ingredient)
    productId: z.string().uuid().optional().nullable(),
    ingredientId: z.string().uuid().optional().nullable(),

    warehouseId: z.string().uuid(), // ⚠️ Wajib: Stok fisik harus punya lokasi

    variantId: z.string().uuid().optional().nullable(),
    batchId: z.string().uuid().optional().nullable(),

    // Tipe aksi yang diperbolehkan dari UI Frontend
    type: z.enum(["restock", "correction", "damage", "void", "production"]),

    quantity: z.number().nonnegative("Jumlah harus positif"),

    // ✅ Unit Cost: Input number dari UI, tapi nanti disimpan sebagai Text di DB
    unitCost: z.number().nonnegative().optional(),

    note: z.string().min(1, "Wajib menyertakan catatan (audit trail)"),
    referenceId: z.string().optional(), // ID Referensi luar (misal No. PO)
  })
  .refine((data) => data.productId || data.ingredientId, {
    message: "Harus menyertakan Product ID atau Ingredient ID",
    path: ["productId"], // Error akan muncul di field productId
  });

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

// --- 2. SERVICE IMPLEMENTATION ---

export const InventoryService = {
  /**
   * Mendapatkan stok saat ini berdasarkan Agregasi (SUM).
   * Supports: Product, Variant, dan Ingredient.
   */
  async getCurrentStock(
    target: {
      productId?: string;
      ingredientId?: string;
      variantId?: string | null;
    },
    warehouseId?: string,
  ) {
    const db = getDb();
    const filters = [];

    // Filter Dynamic berdasarkan target (Barang Jadi vs Bahan Baku)
    if (target.productId)
      filters.push(eq(schema.stockMovements.productId, target.productId));
    if (target.ingredientId)
      filters.push(eq(schema.stockMovements.ingredientId, target.ingredientId));
    if (target.variantId)
      filters.push(eq(schema.stockMovements.variantId, target.variantId));

    // Filter Gudang (Opsional, jika null berarti cek stok global satu perusahaan)
    if (warehouseId)
      filters.push(eq(schema.stockMovements.warehouseId, warehouseId));

    // Safety: Jangan query jika tidak ada ID target
    if (filters.length === 0) return 0;

    const [result] = await db
      .select({
        total:
          sql<number>`COALESCE(SUM(${schema.stockMovements.quantity}), 0)`.mapWith(
            Number,
          ),
      })
      .from(schema.stockMovements)
      .where(and(...filters));

    return result?.total ?? 0;
  },

  /**
   * CORE LOGIC: Mengubah stok dengan prinsip Double-Entry Log.
   * Menangani Product & Ingredient, serta konversi tipe data Text/Real.
   */
  async adjustStock(input: AdjustStockInput, userId: string) {
    // 1. Validasi Input Zod
    const validated = adjustStockSchema.parse(input);
    const db = getDb();

    return await runTransactionWithRetry(db, async (tx) => {
      let branchId = "";
      let itemName = "";
      let currentCostString = "0"; // Default string "0"

      // 2. IDENTIFIKASI ITEM & FETCH DATA MASTER
      // Kita perlu mengambil Branch ID dan Cost Price terakhir untuk snapshot

      if (validated.productId) {
        // --- LOGIC PRODUK ---
        const [product] = await tx
          .select({
            branchId: schema.products.branchId,
            name: schema.products.name,
            cost: schema.products.costPrice, // Asumsi costPrice di Product disimpan sbg Text
          })
          .from(schema.products)
          .where(eq(schema.products.id, validated.productId));

        if (!product) throw new Error("Produk tidak ditemukan.");
        branchId = product.branchId!;
        itemName = product.name;
        currentCostString = String(product.cost ?? "0");
      } else if (validated.ingredientId) {
        // --- LOGIC BAHAN BAKU (INGREDIENT) ---
        const [ingredient] = await tx
          .select({
            id: schema.ingredients.id,
            name: schema.ingredients.name,
            cost: schema.ingredients.costPerUnit, // Asumsi costPerUnit di Ingredient
          })
          .from(schema.ingredients)
          .where(eq(schema.ingredients.id, validated.ingredientId));

        if (!ingredient) throw new Error("Bahan baku tidak ditemukan.");

        // ⚠️ Fallback Branch:
        // Jika Ingredient bersifat global (tidak punya branchId), kita ambil branchId dari Warehouse transaksi.
        // Karena 'stockMovements' WAJIB punya branchId.
        const [wh] = await tx
          .select({ branchId: schema.warehouses.branchId })
          .from(schema.warehouses)
          .where(eq(schema.warehouses.id, validated.warehouseId));

        if (!wh) throw new Error("Gudang tidak valid.");

        branchId = wh.branchId;
        itemName = ingredient.name;
        currentCostString = String(ingredient.cost ?? "0");
      }

      if (!branchId)
        throw new Error(
          "Data Error: Branch ID tidak ditemukan untuk transaksi ini.",
        );

      // 3. HITUNG STOK EKSISTING (Jika tipe transaksi adalah Correction/Opname)
      let currentQty = 0;
      if (validated.type === "correction") {
        currentQty = await InventoryService.getCurrentStock(
          {
            productId: validated.productId ?? undefined,
            ingredientId: validated.ingredientId ?? undefined,
            variantId: validated.variantId,
          },
          validated.warehouseId,
        );
      }

      // 4. HITUNG DELTA (SELISIH) & MAPPING KE DB ENUM
      let delta = 0;
      let dbMovementType: z.infer<typeof movementTypeSchema> = "adjustment";

      switch (validated.type) {
        case "restock":
          delta = validated.quantity;
          dbMovementType = "purchase";
          break;
        case "production":
          delta = validated.quantity; // Bisa positif (produk jadi) atau negatif (bahan baku terpakai)
          // Note: Di UI biasanya production restock = produk jadi nambah.
          dbMovementType = "production";
          break;
        case "damage":
        case "void":
          delta = -validated.quantity; // Mengurangi stok
          dbMovementType = validated.type === "void" ? "void" : "damage";
          break;
        case "correction":
          // Logic: Input User (Real) - Stok Sistem = Selisih
          delta = validated.quantity - currentQty;

          if (delta === 0) {
            return {
              success: true,
              message: "Stok fisik sudah sesuai dengan sistem.",
              newStock: currentQty,
            };
          }
          dbMovementType = "adjustment";
          break;
      }

      // 5. STANDARDISASI REFERENCE & COST
      // Mapping tipe transaksi UI ke Reference Type Database agar seragam
      const referenceTypeMap: Record<string, string> = {
        restock: "purchase_order",
        correction: "stock_opname",
        damage: "damage_report",
        void: "void_log",
        production: "production_log",
      };

      // Pastikan unitCost masuk sebagai String ke DB (sesuai Schema)
      const finalUnitCost = validated.unitCost
        ? String(validated.unitCost)
        : currentCostString;

      const now = new Date();

      // 6. EXECUTE INSERT (MENGGUNAKAN SEMUA KOLOM SCHEMA)
      await tx.insert(schema.stockMovements).values({
        id: uuidv7(),
        branchId: branchId, // ✅ Wajib Foreign Key
        warehouseId: validated.warehouseId, // ✅ Wajib Foreign Key

        productId: validated.productId ?? null, // ✅ Nullable
        ingredientId: validated.ingredientId ?? null, // ✅ Nullable (Terisi jika bahan baku)
        variantId: validated.variantId ?? null, // ✅ Nullable
        batchId: validated.batchId ?? null, // ✅ Nullable

        userId: userId, // ✅ Wajib (Audit User)

        type: dbMovementType, // ✅ Enum Strict
        quantity: delta, // ✅ Real/Float

        unitCost: finalUnitCost, // ✅ Text (Snapshot harga saat kejadian)

        note: validated.note,
        referenceId: validated.referenceId,
        referenceType: referenceTypeMap[validated.type] ?? "manual_adjustment", // ✅ Standardized String

        createdAt: now,
        updatedAt: now,
        version: 1, // 🔄 Sync Logic
        syncStatus: false, // 🔄 Sync Logic
      });

      // 7. TOUCH PARENT ENTITY (Untuk Trigger Sync ke Cloud)
      // Kita update 'version' produk/ingredient agar worker sync tahu ada perubahan data terkait.
      if (validated.productId) {
        await tx
          .update(schema.products)
          .set({
            updatedAt: now,
            version: sql`${schema.products.version} + 1`,
            syncStatus: false,
          })
          .where(eq(schema.products.id, validated.productId));
      } else if (validated.ingredientId) {
        await tx
          .update(schema.ingredients)
          .set({
            updatedAt: now,
            version: sql`${schema.ingredients.version} + 1`,
            syncStatus: false,
          })
          .where(eq(schema.ingredients.id, validated.ingredientId));
      }

      // 8. TAURI NATIVE CAPABILITIES (Desktop Only)
      if (isTauri()) {
        // Feedback Getar/Suara
        invokeTauri("trigger_feedback", { status: "success" });

        // Secure Audit Log ke File System (Anti-Tamper)
        const logMsg = `[${dbMovementType.toUpperCase()}] Item: ${itemName} | Qty: ${delta} | Loc: ${validated.warehouseId}`;
        invokeTauri("write_secure_log", { message: logMsg, level: "info" });
      }

      return {
        success: true,
        message: "Stok berhasil diperbarui",
        newStock:
          validated.type === "correction"
            ? validated.quantity
            : currentQty + delta,
      };
    });
  },

  /**
   * Mengambil History Mutasi (Kartu Stok)
   * Support Produk & Bahan Baku
   */
  async getHistory(
    targetId: { productId?: string; ingredientId?: string },
    warehouseId?: string,
    limit = 50,
  ) {
    try {
      const db = getDb();

      // Bangun query conditions dynamic
      const conditions = [];
      if (targetId.productId)
        conditions.push(
          eq(schema.stockMovements.productId, targetId.productId),
        );
      if (targetId.ingredientId)
        conditions.push(
          eq(schema.stockMovements.ingredientId, targetId.ingredientId),
        );

      if (warehouseId)
        conditions.push(eq(schema.stockMovements.warehouseId, warehouseId));

      const logs = await db
        .select({
          id: schema.stockMovements.id,
          date: schema.stockMovements.createdAt,
          type: schema.stockMovements.type,
          quantity: schema.stockMovements.quantity,
          note: schema.stockMovements.note,
          unitCost: schema.stockMovements.unitCost, // ✅ Ambil data cost snapshot
          referenceType: schema.stockMovements.referenceType,

          warehouseName: schema.warehouses.name, // ✅ Join nama gudang
          userName: schema.users.name, // ✅ Join nama user
        })
        .from(schema.stockMovements)
        .leftJoin(
          schema.warehouses,
          eq(schema.stockMovements.warehouseId, schema.warehouses.id),
        )
        .leftJoin(
          schema.users,
          eq(schema.stockMovements.userId, schema.users.id),
        )
        .where(and(...conditions))
        .orderBy(desc(schema.stockMovements.createdAt))
        .limit(limit);

      return { success: true, data: logs };
    } catch (error) {
      if (error instanceof Error) {
        console.error("[InventoryService.getHistory] Error:", error.message);
      }
      return { success: false, error: "Gagal memuat history stok." };
    }
  },
};
