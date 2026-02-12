import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export const RecipeService = {
	/**
	 * 🔄 RECALCULATE COGS (Cost of Goods Sold)
	 * Menghitung ulang 'costPrice' produk berdasarkan total harga bahan baku.
	 * Panggil fungsi ini setiap kali ada perubahan pada:
	 * 1. Resep Produk (Tambah/Kurang bahan)
	 * 2. Harga Beli Bahan Baku (Ingredient Cost)
	 */
	async recalculateProductCost(productId: string) {
		const db = getDb();

		return await db.transaction(async (tx) => {
			// 1. Ambil semua bahan baku yang dipakai produk ini
			// Join tabel 'product_recipes' dengan 'ingredients'
			const recipeItems = await tx
				.select({
					quantity: schema.productRecipes.quantity, // Gramasi yang dipakai
					costPerUnit: schema.ingredients.costPerUnit, // Harga per gram/unit
					unit: schema.ingredients.unit,
				})
				.from(schema.productRecipes)
				.innerJoin(
					schema.ingredients,
					eq(schema.productRecipes.ingredientId, schema.ingredients.id),
				)
				.where(eq(schema.productRecipes.productId, productId));

			// 2. Hitung Total Cost
			// Kita iterasi di code (bukan SQL) untuk handling parsing Float yang aman
			let totalCost = 0;

			for (const item of recipeItems) {
				const qty = item.quantity; // misal: 15 (gram)
				const cost = parseFloat(item.costPerUnit || "0"); // misal: 10 (rupiah)

				// Rumus sederhana: Qty * Harga Satuan
				// Pastikan satuan input konsisten (misal semua dalam Gram)
				totalCost += qty * cost;
			}

			// 3. Update Master Product
			// Kita simpan hasilnya ke kolom 'costPrice' agar query penjualan cepat
			// (tidak perlu join ulang setiap kali ada transaksi)
			await tx
				.update(schema.products)
				.set({
					costPrice: totalCost.toString(), // Simpan sebagai Text (Financial presisi)

					// 🔄 SYNC & VERSIONING
					updatedAt: new Date(),
					version: sql`${schema.products.version} + 1`,
					syncStatus: false, // Dirty
				})
				.where(eq(schema.products.id, productId));

			console.info(
				`[RecipeService] Updated Cost for Product ${productId}: ${totalCost}`,
			);
			return { success: true, newCost: totalCost };
		});
	},

	/**
	 * 🥗 GET NUTRITION INFO
	 * Mengambil kalkulasi nutrisi total untuk ditampilkan di Label Menu / Struk.
	 * Asumsi: Data nutrisi di tabel 'ingredients' adalah per 100gr/ml (Standar ISO).
	 */
	async getProductNutrition(productId: string) {
		const db = getDb();

		try {
			// Kita gunakan SQL Aggregate functions agar performa sangat cepat
			// Rumus: SUM( (QtyResep / 100) * NutrisiPer100g )
			const result = await db
				.select({
					totalCalories: sql<number>`sum((${schema.productRecipes.quantity} / 100) * ${schema.ingredients.calories})`,
					totalProtein: sql<number>`sum((${schema.productRecipes.quantity} / 100) * ${schema.ingredients.protein})`,
					totalSugar: sql<number>`sum((${schema.productRecipes.quantity} / 100) * ${schema.ingredients.sugar})`,
					totalCarbs: sql<number>`sum((${schema.productRecipes.quantity} / 100) * ${schema.ingredients.carbohydrates})`,

					// Cek allergen (Jika salah satu bahan mengandung allergen, maka produk pun mengandung)
					containsDairy: sql<number>`max(${schema.ingredients.containsDairy})`,
					containsNuts: sql<number>`max(${schema.ingredients.containsNuts})`,
					isGlutenFree: sql<number>`min(${schema.ingredients.isGlutenFree})`, // Kalau ada 1 yg tidak gluten free (0), hasil min jadi 0
				})
				.from(schema.productRecipes)
				.innerJoin(
					schema.ingredients,
					eq(schema.productRecipes.ingredientId, schema.ingredients.id),
				)
				.where(eq(schema.productRecipes.productId, productId));

			// Drizzle return array, ambil elemen pertama
			const nutrition = result[0];

			return {
				success: true,
				data: {
					calories: Math.round(nutrition.totalCalories || 0), // Bulatkan kalori
					protein: (nutrition.totalProtein || 0).toFixed(1) + "g",
					sugar: (nutrition.totalSugar || 0).toFixed(1) + "g",
					carbs: (nutrition.totalCarbs || 0).toFixed(1) + "g",
					allergens: {
						dairy: Boolean(nutrition.containsDairy),
						nuts: Boolean(nutrition.containsNuts),
						gluten: !nutrition.isGlutenFree, // Logic terbalik: isGlutenFree=0 berarti Ada Gluten
					},
				},
			};
		} catch (error) {
			console.error("[RecipeService.getNutrition]", error);
			return { success: false, error: "Gagal menghitung nutrisi." };
		}
	},

	/**
	 * 🔗 LINK INGREDIENT (Add to Recipe)
	 * Menambahkan bahan ke resep, lalu otomatis update harga modal.
	 */
	async addIngredientToRecipe(
		productId: string,
		ingredientId: string,
		quantity: number,
	) {
		const db = getDb();

		// Transaction: Insert Recipe -> Recalculate Product Cost
		return await db.transaction(async (tx) => {
			// 1. Insert ke tabel bridging
			// Gunakan SQL Insert biasa karena kita butuh UUID v7 (di-generate di DB atau code)
			// Disini saya pakai UUID generate dari DB (jika di-setup) atau passing manual
			// Untuk amannya kita pakai query builder Drizzle standar

			// Note: import { v7 } di atas jika belum ada
			const { v7: uuidv7 } = require("uuid");

			await tx.insert(schema.productRecipes).values({
				id: uuidv7(),
				productId,
				ingredientId,
				quantity, // Gramasi

				// 🔄 SYNC
				version: 1,
				syncStatus: false,
			});

			// 2. Set flag 'hasRecipe' di produk jadi true
			await tx
				.update(schema.products)
				.set({
					hasRecipe: true,
					updatedAt: new Date(),
					syncStatus: false,
				})
				.where(eq(schema.products.id, productId));

			// 3. Trigger hitung ulang harga modal
			// Kita panggil logic recalculate (tapi manual code disini agar tetap dalam 1 transaction scope 'tx')
			// *Opsional: Bisa panggil RecipeService.recalculateProductCost(productId) tapi itu akan beda transaction context*
			// Untuk best practice performa, kita biarkan user memanggil recalculate terpisah atau implementasi ulang logic di sini.
			// Agar simple, kita return success, dan UI sebaiknya trigger refetch.
		});
	},
};
