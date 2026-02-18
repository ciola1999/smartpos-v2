import { eq, inArray, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import * as schema from "@/db/schema";
import { getDb, runTransactionWithRetry } from "@/lib/db";
import type { CheckoutPayload } from "@/lib/validations/schema";

// Custom Error Class agar UI bisa membedakan error validasi vs error sistem
class TransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionError";
  }
}

export const OrderService = {
  /**
   * Memproses transaksi penjualan lengkap (Checkout).
   */
  async createTransaction(payload: CheckoutPayload, cashierId: string) {
    const db = getDb();
    const productIds = payload.items.map((item) => item.productId);

    return await runTransactionWithRetry(db, async (tx) => {
      // 1. Fetch Data
      const dbProducts = await tx
        .select()
        .from(schema.products)
        .where(inArray(schema.products.id, productIds));

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));
      const orderId = uuidv7();

      // 2. Process Items
      const { orderItemsData, stockMovementsData, productsToUpdate, subtotal } =
        this._prepareTransactionData(
          payload.items,
          productMap,
          orderId,
          cashierId,
        );

      // 3. Totals & Tax
      const taxRate = 0.11;
      const subtotalInt = Math.round(subtotal);
      const taxAmount = Math.round(subtotalInt * taxRate);
      const totalAmount = subtotalInt + taxAmount;
      const paid = Math.round(parseFloat(payload.amountPaid));
      const change = paid - totalAmount;

      if (change < 0) {
        throw new TransactionError(
          `Uang pembayaran kurang. Total: ${totalAmount}, Dibayar: ${paid}`,
        );
      }

      // 4. Persistence
      await this._persistTransaction(tx, {
        orderId,
        cashierId,
        payload,
        subtotal,
        taxAmount,
        totalAmount,
        change,
        taxRate,
        orderItemsData,
        stockMovementsData,
        productsToUpdate,
      });

      return { success: true, orderId, totalAmount, change };
    });
  },

  /**
   * 🛠️ Internal: Mempersiapkan data untuk transaksi (Validasi & Kalkulasi)
   */
  _prepareTransactionData(
    items: CheckoutPayload["items"],
    productMap: Map<string, typeof schema.products.$inferSelect>,
    orderId: string,
    cashierId: string,
  ) {
    let subtotal = 0;
    const orderItemsData: (typeof schema.orderItems.$inferInsert)[] = [];
    const stockMovementsData: (typeof schema.stockMovements.$inferInsert)[] =
      [];
    const productsToUpdate: { id: string; newStock: number }[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new TransactionError(`Produk ID ${item.productId} tidak ada.`);
      }
      if (!product.isActive) {
        throw new TransactionError(`Produk "${product.name}" tidak aktif.`);
      }
      if (product.stock < item.quantity) {
        throw new TransactionError(
          `Stok "${product.name}" kurang. Sisa: ${product.stock}`,
        );
      }

      const price = parseFloat(product.price);
      subtotal += price * item.quantity;
      const newStock = product.stock - item.quantity;
      const now = new Date();

      orderItemsData.push({
        id: uuidv7(),
        orderId,
        productId: product.id,
        quantity: item.quantity,
        productNameSnapshot: product.name,
        skuSnapshot: product.sku,
        priceAtTime: product.price,
        costPriceAtTime: product.costPrice,
        createdAt: now,
        updatedAt: now,
        version: 1,
        syncStatus: false,
      });

      productsToUpdate.push({ id: product.id, newStock });

      stockMovementsData.push({
        id: uuidv7(),
        productId: product.id,
        quantity: -item.quantity,
        type: "sale",
        referenceId: orderId,
        referenceType: "order",
        userId: cashierId,
        createdAt: now,
        updatedAt: now,
        version: 1,
        syncStatus: false,
      });
    }

    return { orderItemsData, stockMovementsData, productsToUpdate, subtotal };
  },

  /**
   * 🛠️ Internal: Eksekusi penulisan ke database
   */
  async _persistTransaction(
    tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
    data: {
      orderId: string;
      cashierId: string;
      payload: CheckoutPayload;
      subtotal: number;
      taxAmount: number;
      totalAmount: number;
      change: number;
      taxRate: number;
      orderItemsData: (typeof schema.orderItems.$inferInsert)[];
      stockMovementsData: (typeof schema.stockMovements.$inferInsert)[];
      productsToUpdate: { id: string; newStock: number }[];
    },
  ) {
    const {
      orderId,
      cashierId,
      payload,
      subtotal,
      taxAmount,
      totalAmount,
      change,
      taxRate,
      orderItemsData,
      stockMovementsData,
      productsToUpdate,
    } = data;

    // A. Update Stok
    for (const p of productsToUpdate) {
      await tx
        .update(schema.products)
        .set({
          stock: p.newStock,
          updatedAt: new Date(),
          version: sql`${schema.products.version} + 1`,
          syncStatus: false,
        })
        .where(eq(schema.products.id, p.id));
    }

    // B. Insert Order
    await tx.insert(schema.orders).values({
      id: orderId,
      cashierId,
      memberId: payload.memberId,
      discountId: payload.discountId,
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      totalAmount: totalAmount.toString(),
      amountPaid: payload.amountPaid,
      change: change.toString(),
      paymentMethod: payload.paymentMethod,
      orderType: payload.orderType,
      tableNumber: payload.tableNumber,
      status: "completed",
      taxNameSnapshot: "PPN",
      taxRateSnapshot: taxRate.toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      syncStatus: false,
    });

    // C. Bulk Inserts
    if (orderItemsData.length > 0)
      await tx.insert(schema.orderItems).values(orderItemsData);
    if (stockMovementsData.length > 0)
      await tx.insert(schema.stockMovements).values(stockMovementsData);

    // D. Payment Record
    await tx.insert(schema.orderPayments).values({
      id: uuidv7(),
      orderId,
      paymentMethod: payload.paymentMethod,
      amount: payload.amountPaid,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      syncStatus: false,
    });
  },
};
