import { and, eq, isNull, sql } from "drizzle-orm";
import type { SQLiteTransaction } from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";

// Type definition untuk Transaction agar tidak menggunakan 'any'
// Menggunakan 'any' pada generic di sini aman karena kita hanya butuh wrapper-nya
type Tx = SQLiteTransaction<any, any, any, any>;

// 🛡️ 1. Validation Schema
export const RecipeMutationSchema = z.object({
  productId: z.string().uuid(),
  ingredientId: z.string().uuid(),
  quantity: z.number().positive("Quantity harus lebih dari 0"),
  // Kita hapus validasi 'unit' untuk insert DB, tapi bisa tetap ada di UI form jika perlu
  // notes: z.string().optional(), // Opsional: jika mau ditambahkan
});

export const RecipeService = {
  /**
   * 🧠 CORE ENGINE: Recalculate Cost & Nutrition
   */
  async _syncProductAggregates(tx: Tx, productId: string) {
    const now = new Date();

    // A. Ambil semua bahan aktif
    const items = await tx
      .select({
        qty: schema.productRecipes.quantity,
        // HAPUS: recipeUnit (tidak ada di schema)
        costPerUnit: schema.ingredients.costPerUnit,
        ingUnit: schema.ingredients.unit,
        calories: schema.ingredients.calories,
        protein: schema.ingredients.protein,
        carbs: schema.ingredients.carbohydrates,
        sugar: schema.ingredients.sugar,
        fat: schema.ingredients.fat,
        hasDairy: schema.ingredients.containsDairy,
        hasNuts: schema.ingredients.containsNuts,
        isGlutenFree: schema.ingredients.isGlutenFree,
      })
      .from(schema.productRecipes)
      .innerJoin(
        schema.ingredients,
        eq(schema.productRecipes.ingredientId, schema.ingredients.id),
      )
      .where(
        and(
          eq(schema.productRecipes.productId, productId),
          isNull(schema.productRecipes.deletedAt),
        ),
      );

    // B. Kalkulasi In-Memory
    let totalCost = 0;
    const nutrition = {
      calories: 0,
      protein: 0,
      carbs: 0,
      sugar: 0,
      fat: 0,
      allergens: { dairy: false, nuts: false, gluten: false },
    };

    for (const item of items) {
      const normalizedQty = item.qty;

      // Hitung Cost
      totalCost += normalizedQty * parseFloat(item.costPerUnit || "0");

      // Hitung Nutrisi (Asumsi: Nutrisi di DB adalah per 100 unit/gram)
      const ratio = normalizedQty / 100;
      nutrition.calories += (item.calories || 0) * ratio;
      nutrition.protein += (item.protein || 0) * ratio;
      nutrition.carbs += (item.carbs || 0) * ratio;
      nutrition.sugar += (item.sugar || 0) * ratio;
      nutrition.fat += (item.fat || 0) * ratio;

      if (item.hasDairy) nutrition.allergens.dairy = true;
      if (item.hasNuts) nutrition.allergens.nuts = true;
      if (!item.isGlutenFree) nutrition.allergens.gluten = true;
    }

    // C. Atomic Update ke Product Master
    await tx
      .update(schema.products)
      .set({
        costPrice: totalCost.toString(),
        hasRecipe: items.length > 0,
        // Simpan nutrisi sebagai JSON string di kolom description (atau kolom lain jika ada)
        description: JSON.stringify(nutrition),
        updatedAt: now,
        version: sql`${schema.products.version} + 1`,
        syncStatus: false,
      })
      .where(eq(schema.products.id, productId));

    return { totalCost, nutrition };
  },

  /**
   * ➕ ADD INGREDIENT
   */
  async addIngredient(data: z.infer<typeof RecipeMutationSchema>) {
    const validated = RecipeMutationSchema.parse(data);
    const db = getDb();
    const now = new Date();

    return await db.transaction(async (tx) => {
      // 1. Insert Recipe Item
      // FIX: Hapus 'unit', ganti 1n dengan 1
      await tx.insert(schema.productRecipes).values({
        id: uuidv7(),
        productId: validated.productId,
        ingredientId: validated.ingredientId,
        quantity: validated.quantity,
        // unit: validated.unit, // REMOVED: Tidak ada di schema
        createdAt: now,
        updatedAt: now,
        version: 1, // FIX: Menggunakan number, bukan BigInt (1n)
        syncStatus: false,
      });

      // 2. Auto Recalculate
      const result = await this._syncProductAggregates(tx, validated.productId);

      return { success: true, ...result };
    });
  },

  /**
   * ✏️ UPDATE RECIPE QUANTITY
   */
  async updateIngredientQty(
    recipeId: string,
    productId: string,
    newQty: number,
  ) {
    const db = getDb();

    return await db.transaction(async (tx) => {
      await tx
        .update(schema.productRecipes)
        .set({
          quantity: newQty,
          updatedAt: new Date(),
          version: sql`${schema.productRecipes.version} + 1`,
          syncStatus: false,
        })
        .where(eq(schema.productRecipes.id, recipeId));

      const result = await this._syncProductAggregates(tx, productId);

      return { success: true, ...result };
    });
  },

  /**
   * 🗑️ REMOVE INGREDIENT (SOFT DELETE)
   */
  async removeIngredient(recipeId: string, productId: string) {
    const db = getDb();

    return await db.transaction(async (tx) => {
      await tx
        .update(schema.productRecipes)
        .set({
          deletedAt: new Date(),
          syncStatus: false,
          version: sql`${schema.productRecipes.version} + 1`,
        })
        .where(eq(schema.productRecipes.id, recipeId));

      const result = await this._syncProductAggregates(tx, productId);

      return { success: true, ...result };
    });
  },

  /**
   * 📊 GET FULL RECIPE DETAILS
   */
  async getProductRecipe(productId: string) {
    const db = getDb();

    const rows = await db
      .select({
        recipeId: schema.productRecipes.id,
        ingredientId: schema.ingredients.id,
        name: schema.ingredients.name,
        qty: schema.productRecipes.quantity,
        // unit: schema.productRecipes.unit, // REMOVED
        ingredientUnit: schema.ingredients.unit, // Mengambil unit dari master ingredient
        costPerUnit: schema.ingredients.costPerUnit,
        stock: schema.ingredients.stock,
      })
      .from(schema.productRecipes)
      .innerJoin(
        schema.ingredients,
        eq(schema.productRecipes.ingredientId, schema.ingredients.id),
      )
      .where(
        and(
          eq(schema.productRecipes.productId, productId),
          isNull(schema.productRecipes.deletedAt),
        ),
      );

    // Transform data untuk UI (menghitung total cost per item)
    return rows.map((row) => ({
      ...row,
      totalCost: row.qty * parseFloat(row.costPerUnit || "0"),
    }));
  },
};
