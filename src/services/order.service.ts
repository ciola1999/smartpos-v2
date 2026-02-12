import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import type { CheckoutPayload } from "@/lib/validations/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

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
	 * - Validasi Stok
	 * - Update Stok (Potong)
	 * - Catat Inventory Log (Sale)
	 * - Simpan Order & Detail (Snapshot Harga)
	 * - Simpan Pembayaran
	 */
	async createTransaction(payload: CheckoutPayload, cashierId: string) {
		const db = getDb(); // 🔥 Ambil koneksi database

		// 1. Ambil ID semua produk yang dibeli
		const productIds = payload.items.map((item) => item.productId);

		// 2. Mulai Database Transaction (Atomic Operation)
		return await db.transaction(async (tx) => {
			// A. Fetch Data Produk Terbaru (Jangan percaya harga dari Frontend 100%)
			const dbProducts = await tx
				.select()
				.from(schema.products)
				.where(inArray(schema.products.id, productIds));

			// Map untuk akses cepat (O(1)) berdasarkan ID
			const productMap = new Map(dbProducts.map((p) => [p.id, p]));

			// B. Validasi Ketersediaan & Hitung Subtotal
			let calculatedSubtotal = 0;
			const orderItemsData: (typeof schema.orderItems.$inferInsert)[] = [];
			const inventoryLogsData: (typeof schema.inventoryLogs.$inferInsert)[] =
				[];
			const productsToUpdate: { id: string; newStock: number }[] = [];

			const orderId = uuidv7();

			for (const item of payload.items) {
				const product = productMap.get(item.productId);

				// 🛡️ Guard: Produk tidak ditemukan
				if (!product) {
					throw new TransactionError(
						`Produk dengan ID ${item.productId} tidak ditemukan.`,
					);
				}

				// 🛡️ Guard: Produk non-aktif
				if (!product.isActive) {
					throw new TransactionError(
						`Produk "${product.name}" sedang tidak aktif.`,
					);
				}

				// 🛡️ Guard: Stok habis (Kecuali Anda izinkan overselling)
				if (product.stock < item.quantity) {
					throw new TransactionError(
						`Stok "${product.name}" tidak cukup. Sisa: ${product.stock}, Diminta: ${item.quantity}`,
					);
				}

				// 💰 Financial: Hitung harga & modal
				const price = parseFloat(product.price);
				const cost = parseFloat(product.costPrice);
				const lineTotal = price * item.quantity;

				calculatedSubtotal += lineTotal;

				// 📸 Snapshot: Simpan data produk SAAT INI
				orderItemsData.push({
					id: uuidv7(),
					orderId: orderId,
					productId: product.id,
					quantity: item.quantity,

					productNameSnapshot: product.name,
					skuSnapshot: product.sku,

					priceAtTime: product.price, // Harga Jual saat ini
					costPriceAtTime: product.costPrice, // HPP saat ini (Penting untuk Laba Rugi)
				});

				// 📦 Inventory Logic: Persiapkan data log & update stok
				const newStock = product.stock - item.quantity;

				productsToUpdate.push({
					id: product.id,
					newStock: newStock,
				});

				inventoryLogsData.push({
					id: uuidv7(),
					productId: product.id,
					changeAmount: -item.quantity, // Negatif karena barang keluar
					finalStock: newStock,
					type: "sale",
					referenceId: orderId,
					userId: cashierId,

					// 🔄 SYNC
					createdAt: new Date(),
					updatedAt: new Date(),
					version: 1,
					syncStatus: false,
				});
			}

			// C. Kalkulasi Pajak & Total (Sederhana)
			// Idealnya ambil rate dari tabel 'taxes'
			const taxRate = 0.11; // PPN 11%
			const taxAmount = calculatedSubtotal * taxRate;
			const totalAmount = calculatedSubtotal + taxAmount;

			// Hitung kembalian
			const paid = parseFloat(payload.amountPaid);
			const change = paid - totalAmount;

			if (change < 0) {
				throw new TransactionError(
					`Uang pembayaran kurang. Total: ${totalAmount}, Dibayar: ${paid}`,
				);
			}

			// D. Eksekusi Update Stok (Looping update)
			// SQLite handle loop update ini dengan sangat cepat dalam transaction
			for (const p of productsToUpdate) {
				await tx
					.update(schema.products)
					.set({
						stock: p.newStock,
						updatedAt: new Date(),
						version: sql`${schema.products.version} + 1`, // Increment version
						syncStatus: false, // Dirty
					})
					.where(eq(schema.products.id, p.id));
			}

			// E. Insert Order Header
			await tx.insert(schema.orders).values({
				id: orderId,
				cashierId: cashierId,
				memberId: payload.memberId,
				discountId: payload.discountId,

				subtotal: calculatedSubtotal.toString(),
				taxAmount: taxAmount.toString(),
				totalAmount: totalAmount.toString(),

				amountPaid: payload.amountPaid,
				change: change.toString(),

				paymentMethod: payload.paymentMethod,
				orderType: payload.orderType,
				tableNumber: payload.tableNumber,
				status: "completed",

				// Snapshot Tax
				taxNameSnapshot: "PPN",
				taxRateSnapshot: taxRate.toString(),

				// 🔄 SYNC
				createdAt: new Date(),
				updatedAt: new Date(),
				version: 1,
				syncStatus: false,
			});

			// F. Bulk Insert Detail (Items & Logs)
			if (orderItemsData.length > 0) {
				await tx.insert(schema.orderItems).values(orderItemsData);
			}

			if (inventoryLogsData.length > 0) {
				await tx.insert(schema.inventoryLogs).values(inventoryLogsData);
			}

			// G. Insert Payment Record
			await tx.insert(schema.orderPayments).values({
				id: uuidv7(),
				orderId: orderId,
				paymentMethod: payload.paymentMethod,
				amount: payload.amountPaid,

				// 🔄 SYNC
				createdAt: new Date(),
				updatedAt: new Date(),
				version: 1,
				syncStatus: false,
			});

			console.log(`✅ Transaction Success: ${orderId}`);
			return { success: true, orderId, totalAmount, change };
		});
	},
};
