import { products } from "@/db/schema";
import { getDb } from "@/lib/db";
import { type ProductInput, productSchema } from "@/lib/validations/product";
import { desc, eq, like, or } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

export const ProductService = {
	// --- READ ---
	async getAll(query?: string) {
		try {
			const db = getDb();
			const searchFilter = query
				? or(
						like(products.name, `%${query}%`),
						like(products.sku, `%${query}%`),
						like(products.barcode, `%${query}%`),
					)
				: undefined;

			const data = await db
				.select()
				.from(products)
				.where(searchFilter)
				.orderBy(desc(products.createdAt));

			return { success: true, data };
		} catch (error) {
			console.error("Service Error:", error);
			return { success: false, error: "Gagal mengambil data produk." };
		}
	},

	// --- CREATE ---
	async create(rawInput: ProductInput) {
		try {
			const db = getDb();
			const validated = productSchema.parse(rawInput);
			const newId = uuidv7();

			await db.insert(products).values({
				id: newId,
				name: validated.name,
				categoryId: validated.categoryId ?? null,
				sku: validated.sku || null,
				barcode: validated.barcode || null,

				// 💰 Money as Text (Schema kamu)
				price: validated.price.toString(),
				costPrice: "0", // Default value, nanti bisa ditambah di form

				stock: validated.stock,
				unit: validated.unit, // ✅ SEKARANG INI TIDAK ERROR LAGI

				isActive: true,
				// minStock akan pakai default (5) dari schema
			});

			return { success: true, data: newId };
		} catch (error) {
			console.error("Create Error:", error);
			if (error instanceof Error && error.message.includes("UNIQUE")) {
				return { success: false, error: "SKU atau Barcode sudah terdaftar." };
			}
			return { success: false, error: "Gagal membuat produk." };
		}
	},

	// --- UPDATE ---
	async update(id: string, rawInput: ProductInput) {
		try {
			const db = getDb();
			const validated = productSchema.parse(rawInput);

			await db
				.update(products)
				.set({
					name: validated.name,
					categoryId: validated.categoryId ?? null,
					sku: validated.sku || null,
					barcode: validated.barcode || null,

					price: validated.price.toString(), // Number -> String

					stock: validated.stock,
					unit: validated.unit,
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

	// ... delete sama seperti sebelumnya
	async delete(id: string) {
		try {
			const db = getDb();
			await db.delete(products).where(eq(products.id, id));
			return { success: true };
		} catch (error) {
			return { success: false, error: "Gagal menghapus produk." };
		}
	},
};
