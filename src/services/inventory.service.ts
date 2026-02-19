import { and, desc, eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import * as schema from "@/db/schema";
import { getDb, runTransactionWithRetry, type TransactionTx } from "@/lib/db";

// 🔌 TAURI INTEROP (Dynamic Import untuk Hybrid App)
const isTauri = () => typeof window !== "undefined" && "__TAURI__" in window;

async function invokeTauri(
  command: string,
  args: Record<string, unknown> = {},
) {
  if (!isTauri()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(command, args);
  } catch (e) {
    console.warn(`[Tauri] Gagal invoke ${command}:`, e);
  }
}

// --- 1. VALIDATION SCHEMAS (STRICT ZOD) ---

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
    productId: z.string().uuid().optional().nullable(),
    ingredientId: z.string().uuid().optional().nullable(),
    warehouseId: z.string().uuid(),
    variantId: z.string().uuid().optional().nullable(),
    batchId: z.string().uuid().optional().nullable(),
    type: z.enum(["restock", "correction", "damage", "void", "production"]),
    quantity: z.number().nonnegative("Jumlah harus positif"),
    unitCost: z.number().nonnegative().optional(),
    note: z.string().min(1, "Wajib menyertakan catatan (audit trail)"),
    referenceId: z.string().optional(),
  })
  .refine((data) => data.productId || data.ingredientId, {
    message: "Harus menyertakan Product ID atau Ingredient ID",
    path: ["productId"],
  });

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

// ============================================================================
// 2. HELPER FUNCTIONS (Internal)
// ============================================================================

async function fetchItemDetails(
  tx: TransactionTx,
  validated: z.infer<typeof adjustStockSchema>,
) {
  let branchId = "";
  let itemName = "";
  let currentCostString = "0";

  if (validated.productId) {
    const product = await tx.query.products.findFirst({
      where: eq(schema.products.id, validated.productId),
    });
    if (!product) throw new Error("Produk tidak ditemukan.");
    branchId = product.branchId || "";
    itemName = product.name;
    currentCostString = String(product.costPrice ?? "0");
  } else if (validated.ingredientId) {
    const ingredient = await tx.query.ingredients.findFirst({
      where: eq(schema.ingredients.id, validated.ingredientId),
    });
    if (!ingredient) throw new Error("Bahan baku tidak ditemukan.");

    const wh = await tx.query.warehouses.findFirst({
      where: eq(schema.warehouses.id, validated.warehouseId),
      columns: { branchId: true },
    });
    if (!wh) throw new Error("Gudang tidak valid.");

    branchId = wh.branchId;
    itemName = ingredient.name;
    currentCostString = String(ingredient.costPerUnit ?? "0");
  }

  if (!branchId)
    throw new Error(
      "Data Error: Branch ID tidak ditemukan untuk transaksi ini.",
    );

  return { branchId, itemName, currentCostString };
}

function calculateDelta(
  validated: z.infer<typeof adjustStockSchema>,
  currentQty: number,
): { delta: number; dbMovementType: z.infer<typeof movementTypeSchema> } {
  let delta = 0;
  let dbMovementType: z.infer<typeof movementTypeSchema> = "adjustment";

  switch (validated.type) {
    case "restock":
      delta = validated.quantity;
      dbMovementType = "purchase";
      break;
    case "production":
      delta = validated.quantity;
      dbMovementType = "production";
      break;
    case "damage":
    case "void":
      delta = -validated.quantity;
      dbMovementType = validated.type === "void" ? "void" : "damage";
      break;
    case "correction":
      delta = validated.quantity - currentQty;
      dbMovementType = "adjustment";
      break;
  }

  return { delta, dbMovementType };
}

async function recordMovement(
  tx: TransactionTx,
  payload: {
    id: string;
    branchId: string;
    warehouseId: string;
    productId: string | null;
    ingredientId: string | null;
    variantId: string | null;
    batchId: string | null;
    userId: string;
    type: z.infer<typeof movementTypeSchema>;
    quantity: number;
    unitCost: string;
    note: string;
    referenceId?: string;
    referenceType: string;
    now: Date;
  },
) {
  await tx.insert(schema.stockMovements).values({
    id: payload.id,
    branchId: payload.branchId,
    warehouseId: payload.warehouseId,
    productId: payload.productId,
    ingredientId: payload.ingredientId,
    variantId: payload.variantId,
    batchId: payload.batchId,
    userId: payload.userId,
    type: payload.type,
    quantity: payload.quantity,
    unitCost: payload.unitCost,
    note: payload.note,
    referenceId: payload.referenceId,
    referenceType: payload.referenceType,
    createdAt: payload.now,
    updatedAt: payload.now,
    version: 1,
    syncStatus: false,
  });
}

async function touchParent(
  tx: TransactionTx,
  productId: string | null,
  ingredientId: string | null,
  now: Date,
) {
  const versionSql = sql`version + 1`;
  const updateData = {
    updatedAt: now,
    version: versionSql,
    syncStatus: false,
  };

  if (productId) {
    await tx
      .update(schema.products)
      .set(updateData)
      .where(eq(schema.products.id, productId));
  } else if (ingredientId) {
    await tx
      .update(schema.ingredients)
      .set(updateData)
      .where(eq(schema.ingredients.id, ingredientId));
  }
}

async function getCorrectionCurrentStock(
  validated: z.infer<typeof adjustStockSchema>,
) {
  if (validated.type !== "correction") return 0;
  return await InventoryService.getCurrentStock(
    {
      productId: validated.productId ?? undefined,
      ingredientId: validated.ingredientId ?? undefined,
      variantId: validated.variantId,
    },
    validated.warehouseId,
  );
}

const REFERENCE_TYPE_MAP: Record<string, string> = {
  restock: "purchase_order",
  correction: "stock_opname",
  damage: "damage_report",
  void: "void_log",
  production: "production_log",
};

function getReferenceType(type: string): string {
  return REFERENCE_TYPE_MAP[type] ?? "manual_adjustment";
}

function handleTauriFeedback(
  dbMovementType: string,
  itemName: string,
  delta: number,
  warehouseId: string,
) {
  if (isTauri()) {
    invokeTauri("trigger_feedback", { status: "success" });
    const logMsg = `[${dbMovementType.toUpperCase()}] Item: ${itemName} | Qty: ${delta} | Loc: ${warehouseId}`;
    invokeTauri("write_secure_log", { message: logMsg, level: "info" });
  }
}

// ============================================================================
// 3. SERVICE IMPLEMENTATION
// ============================================================================

export const InventoryService = {
  // ... getCurrentStock ...
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

    if (target.productId)
      filters.push(eq(schema.stockMovements.productId, target.productId));
    if (target.ingredientId)
      filters.push(eq(schema.stockMovements.ingredientId, target.ingredientId));
    if (target.variantId)
      filters.push(eq(schema.stockMovements.variantId, target.variantId));

    if (warehouseId)
      filters.push(eq(schema.stockMovements.warehouseId, warehouseId));

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

  async adjustStock(input: AdjustStockInput, userId: string) {
    const validated = adjustStockSchema.parse(input);
    const db = getDb();

    return await runTransactionWithRetry(db, async (tx) => {
      const { branchId, itemName, currentCostString } = await fetchItemDetails(
        tx,
        validated,
      );

      const currentQty = await getCorrectionCurrentStock(validated);

      const { delta, dbMovementType } = calculateDelta(validated, currentQty);

      if (delta === 0 && validated.type === "correction") {
        return {
          success: true,
          message: "Stok fisik sudah sesuai dengan sistem.",
          newStock: currentQty,
        };
      }

      const now = new Date();
      const movementId = uuidv7();

      await recordMovement(tx, {
        id: movementId,
        branchId,
        warehouseId: validated.warehouseId,
        productId: validated.productId ?? null,
        ingredientId: validated.ingredientId ?? null,
        variantId: validated.variantId ?? null,
        batchId: validated.batchId ?? null,
        userId,
        type: dbMovementType,
        quantity: delta,
        unitCost: validated.unitCost
          ? String(validated.unitCost)
          : currentCostString,
        note: validated.note,
        referenceId: validated.referenceId,
        referenceType: getReferenceType(validated.type),
        now,
      });

      await touchParent(
        tx,
        validated.productId ?? null,
        validated.ingredientId ?? null,
        now,
      );

      handleTauriFeedback(
        dbMovementType,
        itemName,
        delta,
        validated.warehouseId,
      );

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

  async getHistory(
    targetId: { productId?: string; ingredientId?: string },
    warehouseId?: string,
    limit = 50,
  ) {
    try {
      const db = getDb();
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
          unitCost: schema.stockMovements.unitCost,
          referenceType: schema.stockMovements.referenceType,
          warehouseName: schema.warehouses.name,
          userName: schema.users.name,
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
