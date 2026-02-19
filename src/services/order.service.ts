import { and, eq, inArray, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import * as schema from "@/db/schema";
import { getDb, type TransactionTx } from "@/lib/db";

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
  taxId?: string | null;
  taxRate?: number; // Snapshot tax rate
  productNameSnapshot?: string;
  skuSnapshot?: string;
  note?: string;
};

export type PaymentPayload = {
  method: "cash" | "debit" | "credit" | "qris" | "transfer" | "split";
  amount: number;
  referenceId?: string;
};

type ProductWithVariants = typeof schema.products.$inferSelect & {
  variants: (typeof schema.productVariants.$inferSelect)[];
};

export type CreateOrderPayload = {
  branchId: string;
  warehouseId: string;
  cashierId: string;
  memberId?: string | null;
  discountId?: string | null;

  // Order Details
  type: "dine_in" | "take_away" | "delivery";
  status?:
    | "draft"
    | "confirmed"
    | "processing"
    | "completed"
    | "cancelled"
    | "refunded";
  tableNumber?: string;
  customerName?: string;
  queueNumber?: number;

  // Financials
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  shippingAmount?: number;
  taxNameSnapshot?: string;
  taxRateSnapshot?: string;

  // Shipping
  shippingAddressId?: string | null;
  billingAddressId?: string | null;

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
// 2. HELPER FUNCTIONS (Internal)
// ============================================================================

/**
 * Memproses satu item dalam order: stok, harga, dan snaphot.
 */
async function processSingleItem(
  tx: TransactionTx,
  item: OrderItemPayload,
  product: ProductWithVariants,
  _payload: CreateOrderPayload,
  _orderId: string,
  now: Date,
) {
  let targetName = product.name;
  let targetSku = product.sku;
  let basePrice = parseMoney(product.price);
  let costPrice = parseMoney(product.costPrice);

  // 1. Varian Handling
  if (item.variantId) {
    const variant = product.variants.find((v) => v.id === item.variantId);
    if (!variant) {
      throw new TransactionError(
        `Varian tidak ditemukan untuk produk ${product.name}`,
      );
    }
    targetName = `${product.name} - ${variant.sku}`;
    targetSku = variant.sku;
    basePrice += parseMoney(variant.priceAdjustment);

    if (product.trackInventory) {
      if ((variant.stock || 0) < item.quantity) {
        throw new TransactionError(`Stok varian "${targetName}" tidak cukup.`);
      }
      await tx
        .update(schema.productVariants)
        .set({
          stock: sql`${schema.productVariants.stock} - ${item.quantity}`,
          updatedAt: now,
          version: sql`${schema.productVariants.version} + 1`,
        })
        .where(eq(schema.productVariants.id, item.variantId));
    }
  }

  // 2. Batch Handling
  if (item.batchId) {
    const batch = await tx.query.batches.findFirst({
      where: and(
        eq(schema.batches.id, item.batchId),
        eq(schema.batches.productId, item.productId),
      ),
    });
    if (!batch || batch.remainingQuantity < item.quantity) {
      throw new TransactionError(`Batch stok tidak cukup untuk ${targetName}`);
    }
    costPrice = parseMoney(batch.unitCost);
    await tx
      .update(schema.batches)
      .set({
        remainingQuantity: sql`${schema.batches.remainingQuantity} - ${item.quantity}`,
        version: sql`${schema.batches.version} + 1`,
      })
      .where(eq(schema.batches.id, item.batchId));
  }

  const itemTotal = basePrice * item.quantity - item.discount;

  return { targetName, targetSku, basePrice, costPrice, itemTotal };
}

/**
 * Memproses setiap item dalam order: validasi stok, update stok, dan hitung total.
 */
async function processOrderItems(
  tx: TransactionTx,
  payload: CreateOrderPayload,
  orderId: string,
  now: Date,
) {
  const productIds = payload.items.map((i) => i.productId);
  const dbProducts = await tx.query.products.findMany({
    where: inArray(schema.products.id, productIds),
    with: { variants: true },
  });

  const productMap = new Map<string, ProductWithVariants>(
    dbProducts.map((p) => [p.id, p]),
  );
  let calculatedSubtotal = 0;
  let totalCOGS = 0;

  const orderItemsInsert: (typeof schema.orderItems.$inferInsert)[] = [];
  const stockMovementsInsert: (typeof schema.stockMovements.$inferInsert)[] =
    [];

  for (const item of payload.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new TransactionError(
        `Produk ID ${item.productId} tidak ditemukan.`,
      );
    }
    if (!product.isActive) {
      throw new TransactionError(
        `Produk "${product.name}" sedang tidak aktif.`,
      );
    }

    const { targetName, targetSku, basePrice, costPrice, itemTotal } =
      await processSingleItem(tx, item, product, payload, orderId, now);

    calculatedSubtotal += itemTotal;
    totalCOGS += costPrice * item.quantity;

    orderItemsInsert.push({
      id: uuidv7(),
      orderId,
      productId: item.productId,
      variantId: item.variantId || null,
      batchId: item.batchId || null,
      taxId: item.taxId || null,
      productNameSnapshot: item.productNameSnapshot || targetName,
      skuSnapshot: item.skuSnapshot || targetSku,
      unitPrice: formatMoney(basePrice),
      quantity: item.quantity,
      discountAmount: formatMoney(item.discount),
      taxRateSnapshot: item.taxRate ? formatMoney(item.taxRate) : null,
      totalAmount: formatMoney(itemTotal),
      costPriceAtTime: formatMoney(costPrice),
      createdAt: now,
      updatedAt: now,
      version: 1,
      syncStatus: false,
    });

    stockMovementsInsert.push({
      id: uuidv7(),
      branchId: payload.branchId,
      warehouseId: payload.warehouseId,
      productId: item.productId,
      variantId: item.variantId || null,
      batchId: item.batchId || null,
      type: "sale",
      quantity: -item.quantity,
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

  return {
    calculatedSubtotal,
    totalCOGS,
    orderItemsInsert,
    stockMovementsInsert,
  };
}

/**
 * Menyiapkan baris jurnal untuk transaksi penjualan.
 */
function prepareJournalLines(
  journalId: string,
  subtotal: number,
  totalPaid: number,
  totalCOGS: number,
): (typeof schema.journalLines.$inferInsert)[] {
  const lines: (typeof schema.journalLines.$inferInsert)[] = [
    {
      id: uuidv7(),
      journalEntryId: journalId,
      accountId: "ACC_REVENUE_ID",
      credit: formatMoney(subtotal),
      description: "Sales Revenue",
    },
    {
      id: uuidv7(),
      journalEntryId: journalId,
      accountId: "ACC_CASH_ID",
      debit: formatMoney(totalPaid),
      description: "Payment Received",
    },
  ];

  if (totalCOGS > 0) {
    lines.push(
      {
        id: uuidv7(),
        journalEntryId: journalId,
        accountId: "ACC_COGS_ID",
        debit: formatMoney(totalCOGS),
        description: "Cost of Goods Sold",
      },
      {
        id: uuidv7(),
        journalEntryId: journalId,
        accountId: "ACC_INVENTORY_ID",
        credit: formatMoney(totalCOGS),
        description: "Inventory Reduction",
      },
    );
  }

  return lines;
}

// ============================================================================
// 3. SERVICE LOGIC
// ============================================================================

/**
 * Menulis header order ke database.
 */
async function createOrderHeader(
  tx: TransactionTx,
  payload: CreateOrderPayload,
  orderId: string,
  orderNumber: string,
  calculatedSubtotal: number,
  now: Date,
) {
  const taxAmount = payload.taxAmount || 0;
  const discountAmount = payload.discountAmount || 0;
  const shippingAmount = payload.shippingAmount || 0;
  const finalTotal =
    calculatedSubtotal + taxAmount + shippingAmount - discountAmount;
  const totalPaid = payload.payments.reduce((sum, p) => sum + p.amount, 0);
  const change = totalPaid - finalTotal;

  await tx.insert(schema.orders).values({
    id: orderId,
    branchId: payload.branchId,
    warehouseId: payload.warehouseId || null,
    cashierId: payload.cashierId,
    memberId: payload.memberId || null,
    discountId: payload.discountId || null,
    orderNumber,
    orderDate: now,
    status: payload.status || "completed",
    orderType: payload.type,
    tableNumber: payload.tableNumber || null,
    customerName: payload.customerName || null,
    queueNumber: payload.queueNumber || null,
    subtotal: formatMoney(calculatedSubtotal),
    discountAmount: formatMoney(discountAmount),
    taxAmount: formatMoney(taxAmount),
    shippingAmount: formatMoney(shippingAmount),
    totalAmount: formatMoney(finalTotal),
    taxNameSnapshot: payload.taxNameSnapshot || null,
    taxRateSnapshot: payload.taxRateSnapshot || null,
    amountPaid: formatMoney(totalPaid),
    change: formatMoney(change),
    shippingAddressId: payload.shippingAddressId || null,
    billingAddressId: payload.billingAddressId || null,
    notes: payload.note || null,
    createdAt: now,
    updatedAt: now,
    version: 1,
    syncStatus: false,
  });

  return { finalTotal, totalPaid, change };
}

/**
 * Mencatat data pembayaran.
 */
async function recordPayments(
  tx: TransactionTx,
  payload: CreateOrderPayload,
  orderId: string,
  now: Date,
) {
  const paymentsToInsert = payload.payments.map((pay) => ({
    id: uuidv7(),
    orderId,
    paymentMethod: pay.method,
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
}

/**
 * Menangani pencatatan akuntansi (Journal Entry).
 */
async function handleAccounting(
  tx: TransactionTx,
  payload: CreateOrderPayload,
  orderNumber: string,
  subtotal: number,
  totalPaid: number,
  totalCOGS: number,
  now: Date,
) {
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

  const journalLines = prepareJournalLines(
    journalId,
    subtotal,
    totalPaid,
    totalCOGS,
  );

  if (journalLines.length > 0) {
    await tx.insert(schema.journalLines).values(journalLines);
  }
}

export const OrderService = {
  async createTransaction(payload: CreateOrderPayload) {
    return await getDb().transaction(async (tx) => {
      const now = new Date();
      const orderId = uuidv7();
      const branchCode = payload.branchId.slice(0, 4).toUpperCase();
      const orderNumber = `ORD-${branchCode}-${Date.now().toString().slice(-6)}`;

      // A. Process Items
      const {
        calculatedSubtotal,
        totalCOGS,
        orderItemsInsert,
        stockMovementsInsert,
      } = await processOrderItems(tx, payload, orderId, now);

      // B. Create Order Header
      const { finalTotal, totalPaid, change } = await createOrderHeader(
        tx,
        payload,
        orderId,
        orderNumber,
        calculatedSubtotal,
        now,
      );

      // C. Bulk Inserts
      if (orderItemsInsert.length > 0)
        await tx.insert(schema.orderItems).values(orderItemsInsert);
      if (stockMovementsInsert.length > 0)
        await tx.insert(schema.stockMovements).values(stockMovementsInsert);

      // D. Record Payments
      await recordPayments(tx, payload, orderId, now);

      // E. Accounting
      await handleAccounting(
        tx,
        payload,
        orderNumber,
        calculatedSubtotal,
        totalPaid,
        totalCOGS,
        now,
      );

      return {
        success: true,
        orderId,
        orderNumber,
        total: finalTotal,
        change,
        timestamp: now,
      };
    });
  },
};
