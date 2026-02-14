import { desc, eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";

// --- VALIDATION SCHEMAS ---
// Kita define di sini atau di lib/validators.ts
export const adjustStockSchema = z.object({
	productId: z.string().uuid(),
	type: z.enum(["restock", "correction", "damage", "sale"]), // 'sale' biasanya otomatis dari OrderService
	quantity: z.number().int().nonnegative("Jumlah harus positif"),
	// Catatan: Untuk 'correction' atau 'damage', quantity input tetap positif,
	// nanti logic yang menentukan apakah menambah/mengurang.
	note: z.string().min(1, "Wajib menyertakan alasan/catatan"),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const InventoryService = {
	/**
	 * Mengubah stok produk dengan Audit Trail lengkap.
	 * Gunakan ini untuk Restock, Barang Rusak, atau Penyesuaian Stok.
	 */
	async adjustStock(input: AdjustStockInput, userId: string) {
		// 1. Validasi Input
		const validated = adjustStockSchema.parse(input);

		return await getDb().transaction(async (tx) => {
			// 2. Ambil Data Produk Terkini (Locking row idealnya, tapi SQLite single-writer safe)
			const [product] = await tx
				.select()
				.from(schema.products)
				.where(eq(schema.products.id, validated.productId));

			if (!product) {
				throw new Error("Produk tidak ditemukan.");
			}

			// 3. Tentukan Arah Perubahan (+ atau -)
			let changeAmount = 0;
			const actionType = validated.type;

			switch (validated.type) {
				case "restock":
					changeAmount = validated.quantity; // Menambah
					break;
				case "damage":
					changeAmount = -validated.quantity; // Mengurang
					break;
				case "correction":
					// Khusus Correction, input quantity adalah "Stok Seharusnya" (Hasil hitung fisik)
					// Jadi kita hitung selisihnya.
					changeAmount = validated.quantity - product.stock;
					// Update note otomatis jika kosong
					if (changeAmount === 0)
						return {
							success: true,
							message: "Stok sudah sesuai, tidak ada perubahan.",
						};
					break;
				default:
					throw new Error("Tipe adjustment tidak valid via service ini.");
			}

			const finalStock = product.stock + changeAmount;

			// 4. Update Table Products
			await tx
				.update(schema.products)
				.set({
					stock: finalStock,
					updatedAt: new Date(),
					version: sql`${schema.products.version} + 1`, // 🔄 SYNC VERSIONING
					syncStatus: false, // 🔄 SYNC DIRTY
				})
				.where(eq(schema.products.id, validated.productId));

			// 5. Catat Log (Kartu Stok)
			await tx.insert(schema.inventoryLogs).values({
				id: uuidv7(),
				productId: validated.productId,
				userId: userId,

				type: actionType,
				changeAmount: changeAmount,
				finalStock: finalStock,
				note: validated.note,

				createdAt: new Date(),
				updatedAt: new Date(),
				version: 1, // 🔄 SYNC
				syncStatus: false, // 🔄 SYNC
			});

			return { success: true, newStock: finalStock };
		});
	},

	/**
	 * Mengambil Riwayat Kartu Stok (History)
	 * Berguna untuk halaman "Detail Produk" -> Tab "History"
	 */
	async getHistory(productId: string, limit = 20) {
		try {
			const logs = await getDb()
				.select({
					id: schema.inventoryLogs.id,
					date: schema.inventoryLogs.createdAt,
					type: schema.inventoryLogs.type,
					change: schema.inventoryLogs.changeAmount,
					finalStock: schema.inventoryLogs.finalStock,
					note: schema.inventoryLogs.note,
					user: schema.users.name, // Join nama user
				})
				.from(schema.inventoryLogs)
				.leftJoin(
					schema.users,
					eq(schema.inventoryLogs.userId, schema.users.id),
				)
				.where(eq(schema.inventoryLogs.productId, productId))
				.orderBy(desc(schema.inventoryLogs.createdAt))
				.limit(limit);

			return { success: true, data: logs };
		} catch (error) {
			console.error("[InventoryService.getHistory]", error);
			return { success: false, error: "Gagal memuat history stok." };
		}
	},
};
