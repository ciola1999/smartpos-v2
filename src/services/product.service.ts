import { inventoryLogs, products } from "@/db/schema";
import { getDb } from "@/lib/db";
import { type ProductInput, productSchema } from "@/lib/validations/product";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

export const ProductService = {
	// --- READ ---
	async getAll(query?: string) {
		try {
			// 1. Filter Pencarian
			const searchFilter = query
				? or(
						like(products.name, `%${query}%`),
						like(products.sku, `%${query}%`),
						like(products.barcode, `%${query}%`),
					)
				: undefined;

			// 2. Query (Hanya yang Active & Belum Deleted)
			// Kita pakai 'and' untuk menggabungkan search + filter aktif
			const whereCondition = and(eq(products.isActive, true), searchFilter);

			const data = await getDb()
				.select()
				.from(products)
				.where(whereCondition)
				.orderBy(desc(products.createdAt));

			return { success: true, data };
		} catch (error) {
			// Gunakan logger sistem, jangan console.log sembarangan di production
			console.error("[ProductService.getAll]", error);
			return { success: false, error: "Gagal mengambil data produk." };
		}
	},

	// --- CREATE ---
	async create(rawInput: ProductInput, userId: string) {
		// Butuh userId untuk Audit Log
		try {
			const validated = productSchema.parse(rawInput);
			const newId = uuidv7();

			// 🔥 TRANSACTION: Wajib atomic (Produk + Log + Sync)
			await getDb().transaction(async (tx) => {
				// 1. Insert Product
				await tx.insert(products).values({
					id: newId,
					name: validated.name,
					categoryId: validated.categoryId ?? null,
					sku: validated.sku || null,
					barcode: validated.barcode || null,

					price: validated.price.toString(),
					costPrice: "0",

					stock: validated.stock,
					unit: validated.unit,

					isActive: true,

					// 🔄 SYNC CRITICAL
					version: 1,
					syncStatus: false, // Dirty (perlu di-push ke cloud)
				});

				// 2. Jika ada Initial Stock, catat di Inventory Log!
				if (validated.stock > 0) {
					await tx.insert(inventoryLogs).values({
						id: uuidv7(),
						productId: newId,
						changeAmount: validated.stock,
						finalStock: validated.stock,
						type: "correction", // atau "restock"
						note: "Initial Stock",
						userId: userId, // Siapa yang input

						// 🔄 SYNC CRITICAL
						version: 1,
						syncStatus: false,
					});
				}
			});

			return { success: true, data: newId };
		} catch (error) {
			// Error handling yang lebih presisi
			if (error instanceof Error) {
				if (error.message.includes("UNIQUE")) {
					return { success: false, error: "SKU atau Barcode sudah terdaftar." };
				}
			}
			return { success: false, error: "Gagal membuat produk." };
		}
	},

	// --- UPDATE ---
	async update(id: string, rawInput: ProductInput) {
		try {
			const validated = productSchema.parse(rawInput);

			// ⚠️ WARNING: Kita menghapus 'stock' dari update disini.
			// Perubahan stok WAJIB lewat fitur "Stock Opname" atau "Restock" terpisah.
			// Agar inventory logs tetap valid.

			await getDb()
				.update(products)
				.set({
					name: validated.name,
					categoryId: validated.categoryId ?? null,
					sku: validated.sku || null,
					barcode: validated.barcode || null,
					price: validated.price.toString(),
					unit: validated.unit,

					// 🔄 SYNC & VERSIONING
					updatedAt: new Date(),
					version: sql`${products.version} + 1`, // Increment version
					syncStatus: false, // Tandai dirty
				})
				.where(eq(products.id, id));

			return { success: true };
		} catch (error) {
			if (error instanceof Error && error.message.includes("UNIQUE")) {
				return { success: false, error: "SKU atau Barcode konflik." };
			}
			return { success: false, error: "Gagal update produk." };
		}
	},

	// --- DELETE (SOFT DELETE) ---
	async delete(id: string) {
		try {
			// Jangan delete row fisik (Hard Delete) agar sync engine tahu ini dihapus
			// Gunakan Soft Delete atau set isActive = false
			await getDb()
				.update(products)
				.set({
					isActive: false, // Atau isi deletedAt

					// 🔄 SYNC
					updatedAt: new Date(),
					version: sql`${products.version} + 1`,
					syncStatus: false,
				})
				.where(eq(products.id, id));

			return { success: true };
		} catch (error) {
			return { success: false, error: "Gagal menghapus produk." };
		}
	},
};
