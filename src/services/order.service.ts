import { and, eq, inArray, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";

// ============================================================================
// 1. TYPE DEFINITIONS & UTILS
// ============================================================================

// Helper: Mengubah string uang dari DB (misal "15000.00") ke number JavaScript
const parseMoney = (value: string | null | undefined): number => {
  return value ? parseFloat(value) : 0;
};

// Helper: Mengubah number ke string untuk disimpan ke DB (SQLite Text)
const formatMoney = (value: number): string => {
  return value.toFixed(2);
};

export type OrderItemPayload = {
  productId: string;
  variantId?: string | null;
  batchId?: string | null;
  quantity: number;
  discount: number; // Nominal diskon
  note?: string;
};

export type PaymentPayload = {
  method: "cash" | "debit" | "credit" | "qris" | "transfer" | "split";
  amount: number;
  referenceId?: string;
};

export type CreateOrderPayload = {
  branchId: string;
  warehouseId: string;
  cashierId: string;
  memberId?: string | null;

  // Order Details
  type: "dine_in" | "take_away" | "delivery"; // Sesuai kolom orderType
  tableNumber?: string;

  items: OrderItemPayload[];
  payments: PaymentPayload[];
  note?: string;
};

class TransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionError";
  }
}

// ============================================================================
// 2. SERVICE LOGIC
// ============================================================================

export const OrderService = {
  /**
   * 🚀 CREATE TRANSACTION (POS CHECKOUT)
   * Melakukan: Inventory Deduct + Financial Record + Journaling + Payment
   * Atomic Transaction: Semua sukses atau rollback semua.
   */
  async createTransaction(payload: CreateOrderPayload) {
    return await getDb().transaction(async (tx) => {
      const now = new Date();
      const orderId = uuidv7();

      // Generate Order Number: ORD-{BRANCH}-{TIMESTAMP}
      const branchCode = payload.branchId.slice(0, 4).toUpperCase();
      const orderNumber = `ORD-${branchCode}-${Date.now().toString().slice(-6)}`;

      // ----------------------------------------------------------------------
      // A. PRE-FETCH DATA (Batching Query)
      // ----------------------------------------------------------------------
      const productIds = payload.items.map((i) => i.productId);

      // Ambil data produk & varian
      const dbProducts = await tx.query.products.findMany({
        where: inArray(schema.products.id, productIds),
        with: {
          variants: true,
        },
      });

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      // Variable akumulasi
      let calculatedSubtotal = 0;
      let totalCOGS = 0; // Cost of Goods Sold untuk Jurnal

      // Array penampung untuk Bulk Insert
      const orderItemsInsert: (typeof schema.orderItems.$inferInsert)[] = [];
      const stockMovementsInsert: (typeof schema.stockMovements.$inferInsert)[] =
        [];
      const journalLinesInsert: (typeof schema.journalLines.$inferInsert)[] =
        [];

      // ----------------------------------------------------------------------
      // B. PROCESS ITEMS (Validation & Calculation)
      // ----------------------------------------------------------------------
      for (const item of payload.items) {
        const product = productMap.get(item.productId);

        // 1. Validasi Produk
        if (!product)
          throw new TransactionError(
            `Produk ID ${item.productId} tidak ditemukan.`,
          );
        if (!product.isActive)
          throw new TransactionError(
            `Produk "${product.name}" sedang tidak aktif.`,
          );

        // 2. Setup Variable Harga & Nama
        let targetName = product.name;
        let targetSku = product.sku;
        let basePrice = parseMoney(product.price);
        let costPrice = parseMoney(product.costPrice);

        // 3. Handle VARIANT
        if (item.variantId) {
          const variant = product.variants.find((v) => v.id === item.variantId);
          if (!variant)
            throw new TransactionError(
              `Varian tidak ditemukan untuk produk ${product.name}`,
            );

          targetName = `${product.name} - ${variant.sku}`; // Atau variant.name jika ada
          targetSku = variant.sku;
          basePrice = basePrice + parseMoney(variant.priceAdjustment);

          // Cek & Update Stok Varian (Jika schema productVariants punya kolom stock)
          const currentVariantStock = variant.stock || 0;
          if (product.trackInventory && currentVariantStock < item.quantity) {
            throw new TransactionError(
              `Stok varian "${targetName}" tidak cukup. Sisa: ${currentVariantStock}`,
            );
          }

          if (product.trackInventory) {
            await tx
              .update(schema.productVariants)
              .set({
                stock: sql`${schema.productVariants.stock} - ${item.quantity}`,
                updatedAt: now,
                version: sql`${schema.productVariants.version} + 1`,
              })
              .where(eq(schema.productVariants.id, item.variantId));
          }
        } else {
          // Handle SIMPLE Product
          // Note: Schema 'products' Anda TIDAK memiliki kolom 'stock'.
          // Jadi kita hanya mencatat movement. Validasi stok diasumsikan via query agregat terpisah atau dilepas.
          // Jika ingin validasi, harus query sum(stockMovements) dulu. Di sini kita skip untuk performa POS.
        }

        // 4. Handle BATCH (FIFO / Expiry)
        if (item.batchId) {
          const batch = await tx.query.batches.findFirst({
            where: and(
              eq(schema.batches.id, item.batchId),
              eq(schema.batches.productId, item.productId),
            ),
          });

          if (!batch || batch.remainingQuantity < item.quantity) {
            throw new TransactionError(
              `Batch stok tidak cukup untuk ${targetName}`,
            );
          }

          // Gunakan Cost Price spesifik dari Batch (Lebih akurat untuk profit margin)
          costPrice = parseMoney(batch.unitCost);

          await tx
            .update(schema.batches)
            .set({
              remainingQuantity: sql`${schema.batches.remainingQuantity} - ${item.quantity}`,
              version: sql`${schema.batches.version} + 1`,
            })
            .where(eq(schema.batches.id, item.batchId));
        }

        // 5. Kalkulasi Final per Item
        const itemTotal = basePrice * item.quantity - item.discount;

        calculatedSubtotal += itemTotal;
        totalCOGS += costPrice * item.quantity;

        // 6. Siapkan Data Order Item
        orderItemsInsert.push({
          id: uuidv7(),
          orderId: orderId,
          productId: item.productId,
          variantId: item.variantId || null,
          batchId: item.batchId || null,

          // Snapshot Data (Penting saat harga master berubah)
          productNameSnapshot: targetName,
          skuSnapshot: targetSku,
          unitPrice: formatMoney(basePrice),
          quantity: item.quantity,
          discountAmount: formatMoney(item.discount),
          totalAmount: formatMoney(itemTotal),
          costPriceAtTime: formatMoney(costPrice),

          createdAt: now,
          updatedAt: now,
          version: 1,
          syncStatus: false,
        });

        // 7. Siapkan Stock Movement (Wajib untuk semua item yg trackInventory)
        stockMovementsInsert.push({
          id: uuidv7(),
          branchId: payload.branchId,
          warehouseId: payload.warehouseId,
          productId: item.productId,
          variantId: item.variantId || null,
          batchId: item.batchId || null,

          type: "sale",
          quantity: -item.quantity, // Negatif = Stok Keluar
          referenceId: orderId,
          referenceType: "order",
          unitCost: formatMoney(costPrice),

          userId: payload.cashierId,
          createdAt: now,
          updatedAt: now,
          version: 1,
          syncStatus: false,
        });
      }

      // ----------------------------------------------------------------------
      // C. CREATE ORDER HEADER
      // ----------------------------------------------------------------------
      // Asumsi pajak 0 dulu (logic pajak biasanya kompleks di settings)
      const taxAmount = 0;
      const finalTotal = calculatedSubtotal + taxAmount;
      const totalPaid = payload.payments.reduce((sum, p) => sum + p.amount, 0);
      const change = totalPaid - finalTotal;

      await tx.insert(schema.orders).values({
        id: orderId,
        branchId: payload.branchId,
        warehouseId: payload.warehouseId,
        cashierId: payload.cashierId,
        memberId: payload.memberId || null,

        orderNumber: orderNumber,
        orderDate: now,
        status: "completed",
        orderType: payload.type,
        tableNumber: payload.tableNumber,

        // Simpan sebagai STRING sesuai schema
        subtotal: formatMoney(calculatedSubtotal),
        taxAmount: formatMoney(taxAmount),
        totalAmount: formatMoney(finalTotal),
        amountPaid: formatMoney(totalPaid),
        change: formatMoney(change),

        notes: payload.note,
        createdAt: now,
        updatedAt: now,
        version: 1,
        syncStatus: false,
      });

      // ----------------------------------------------------------------------
      // D. BULK INSERTS (Performance Optimization)
      // ----------------------------------------------------------------------
      if (orderItemsInsert.length > 0) {
        await tx.insert(schema.orderItems).values(orderItemsInsert);
      }
      if (stockMovementsInsert.length > 0) {
        await tx.insert(schema.stockMovements).values(stockMovementsInsert);
      }

      // ----------------------------------------------------------------------
      // E. RECORD PAYMENTS
      // ----------------------------------------------------------------------
      const paymentsToInsert: (typeof schema.orderPayments.$inferInsert)[] =
        payload.payments.map((pay) => ({
          id: uuidv7(),
          orderId: orderId,
          paymentMethod: pay.method, // Sekarang sudah safe karena tipenya sinkron
          amount: formatMoney(pay.amount),
          referenceId: pay.referenceId || null,
          createdAt: now,
          updatedAt: now,
          version: 1,
          syncStatus: false,
        }));

      if (paymentsToInsert.length > 0) {
        await tx.insert(schema.orderPayments).values(paymentsToInsert);
      }

      // ----------------------------------------------------------------------
      // F. ACCOUNTING / JURNAL OTOMATIS (Double-Entry)
      // ----------------------------------------------------------------------
      const journalId = uuidv7();

      await tx.insert(schema.journalEntries).values({
        id: journalId,
        branchId: payload.branchId,
        entryDate: now,
        reference: orderNumber,
        description: `POS Sales: ${orderNumber}`,
        createdBy: payload.cashierId,
        createdAt: now,
        updatedAt: now,
        version: 1,
        syncStatus: false,
      });

      // 1. KREDIT: Pendapatan Penjualan (Sales Revenue)
      journalLinesInsert.push({
        id: uuidv7(),
        journalEntryId: journalId,
        accountId: "ACC_REVENUE_ID", // TODO: Ambil ID akun 'Sales' dari settings cabang
        credit: formatMoney(calculatedSubtotal),
        description: "Sales Revenue",
      });

      // 2. DEBIT: Kas / Bank (Cash on Hand)
      journalLinesInsert.push({
        id: uuidv7(),
        journalEntryId: journalId,
        accountId: "ACC_CASH_ID", // TODO: Ambil ID akun sesuai Payment Method
        debit: formatMoney(finalTotal),
        description: "Payment Received",
      });

      // 3. Jurnal HPP (COGS) & Persediaan (Inventory) - Perpetual System
      if (totalCOGS > 0) {
        // DEBIT: Harga Pokok Penjualan (Expense)
        journalLinesInsert.push({
          id: uuidv7(),
          journalEntryId: journalId,
          accountId: "ACC_COGS_ID", // TODO: Ambil ID akun COGS
          debit: formatMoney(totalCOGS),
          description: "Cost of Goods Sold",
        });

        // KREDIT: Persediaan Barang (Asset)
        journalLinesInsert.push({
          id: uuidv7(),
          journalEntryId: journalId,
          accountId: "ACC_INVENTORY_ID", // TODO: Ambil ID akun Inventory
          credit: formatMoney(totalCOGS),
          description: "Inventory Reduction",
        });
      }

      // Insert Journal Lines
      if (journalLinesInsert.length > 0) {
        // Casting as any karena TS kadang rewel dengan array union insert di Drizzle
        await tx.insert(schema.journalLines).values(journalLinesInsert as any);
      }

      return {
        success: true,
        orderId,
        orderNumber,
        total: finalTotal,
        change: change,
        timestamp: now,
      };
    });
  },
};
