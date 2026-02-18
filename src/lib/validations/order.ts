import { z } from "zod";

// ============================================================================
// 1. ENUMS & CONSTANTS (Single Source of Truth)
// ============================================================================

// Sesuai dengan string literal di schema.ts (kolom paymentMethod)
export const PAYMENT_METHODS = [
  "cash",
  "debit",
  "credit",
  "qris",
  "transfer",
  "split",
] as const;

// Sesuai dengan string literal di schema.ts (kolom orderType)
export const ORDER_TYPES = ["dine_in", "take_away", "delivery"] as const;

// ============================================================================
// 2. SUB-SCHEMAS
// ============================================================================

export const orderItemSchema = z.object({
  productId: z.string().min(1, "Product ID wajib diisi"),

  variantId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),

  quantity: z.coerce
    .number()
    .int("Jumlah harus bilangan bulat")
    .min(1, "Minimal beli 1 item"),

  discount: z.coerce.number().min(0, "Diskon tidak boleh minus").default(0),

  note: z.string().max(255, "Catatan maksimal 255 karakter").optional(),
});

export const paymentSchema = z.object({
  // FIX: Hapus errorMap untuk kompatibilitas 'as const'
  method: z.enum(PAYMENT_METHODS),

  amount: z.coerce.number().min(1, "Nominal pembayaran tidak valid"),

  referenceId: z.string().optional(),
});

// ============================================================================
// 3. MAIN SCHEMA (CREATE ORDER)
// ============================================================================

export const createOrderSchema = z
  .object({
    branchId: z.string().min(1, "Branch ID hilang"),
    warehouseId: z.string().min(1, "Warehouse ID hilang"),
    cashierId: z.string().min(1, "Cashier ID hilang"),

    memberId: z.string().optional().nullable(),

    // FIX: Hapus errorMap
    type: z.enum(ORDER_TYPES),

    tableNumber: z.string().max(10).optional(),

    items: z.array(orderItemSchema).min(1, "Keranjang belanja kosong!"),

    payments: z.array(paymentSchema).min(1, "Pembayaran belum dipilih"),

    note: z.string().max(500).optional(),
  })
  // Validasi Logic Tambahan
  .superRefine((data, ctx) => {
    if (data.type === "dine_in" && !data.tableNumber) {
      // Optional warning logic
    }

    // Validasi Duplikasi Item
    const uniqueItems = new Set();
    data.items.forEach((item, index) => {
      const key = `${item.productId}-${item.variantId || "base"}-${item.batchId || "base"}`;
      if (uniqueItems.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Item duplikat terdeteksi. Silakan gabungkan quantity.",
          path: ["items", index],
        });
      }
      uniqueItems.add(key);
    });
  });

// ============================================================================
// 4. TYPE EXPORTS
// ============================================================================

export type OrderItemFormValues = z.infer<typeof orderItemSchema>;
export type PaymentFormValues = z.infer<typeof paymentSchema>;
export type CreateOrderFormValues = z.infer<typeof createOrderSchema>;
