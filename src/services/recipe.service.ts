import { eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import * as schema from "@/db/schema";
import { getDb, runTransactionWithRetry } from "@/lib/db";

export const RecipeService = {
  /**
   * 🔄 RECALCULATE COGS (Cost of Goods Sold)
   * Menghitung ulang 'costPrice' produk berdasarkan total harga bahan baku.
   */
  async recalculateProductCost(productId: string) {
    const db = getDb();

    return await runTransactionWithRetry(db, async (tx) => {
      // 1. Ambil semua bahan baku yang dipakai produk ini
      const recipeItems = await tx
        .select({
          quantity: schema.productRecipes.quantity,
          costPerUnit: schema.ingredients.costPerUnit,
          unit: schema.ingredients.unit,
        })
        .from(schema.productRecipes)
        .innerJoin(
          schema.ingredients,
          eq(schema.productRecipes.ingredientId, schema.ingredients.id),
        )
        .where(eq(schema.productRecipes.productId, productId));

      // 2. Hitung Total Cost
      let totalCost = 0;
      for (const item of recipeItems) {
        const qty = item.quantity;
        const cost = parseFloat(item.costPerUnit || "0");
        totalCost += qty * cost;
      }

      // 3. Update Master Product
      await tx
        .update(schema.products)
        .set({
          costPrice: totalCost.toString(),
          updatedAt: new Date(),
          version: sql`${schema.products.version} + 1`,
          syncStatus: false,
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
   */
  async getProductNutrition(productId: string) {
    const db = getDb();

    try {
      const result = await db
        .select({
          totalCalories: sql<number>`sum((${schema.productRecipes.quantity} / 100) * ${schema.ingredients.calories})`,
          totalProtein: sql<number>`sum((${schema.productRecipes.quantity} / 100) * ${schema.ingredients.protein})`,
          totalSugar: sql<number>`sum((${schema.productRecipes.quantity} / 100) * ${schema.ingredients.sugar})`,
          totalCarbs: sql<number>`sum((${schema.productRecipes.quantity} / 100) * ${schema.ingredients.carbohydrates})`,
          containsDairy: sql<number>`max(${schema.ingredients.containsDairy})`,
          containsNuts: sql<number>`max(${schema.ingredients.containsNuts})`,
          isGlutenFree: sql<number>`min(${schema.ingredients.isGlutenFree})`,
        })
        .from(schema.productRecipes)
        .innerJoin(
          schema.ingredients,
          eq(schema.productRecipes.ingredientId, schema.ingredients.id),
        )
        .where(eq(schema.productRecipes.productId, productId));

      const nutrition = result[0];

      return {
        success: true,
        data: {
          calories: Math.round(nutrition.totalCalories || 0),
          protein: `${(nutrition.totalProtein || 0).toFixed(1)}g`,
          sugar: `${(nutrition.totalSugar || 0).toFixed(1)}g`,
          carbs: `${(nutrition.totalCarbs || 0).toFixed(1)}g`,
          allergens: {
            dairy: Boolean(nutrition.containsDairy),
            nuts: Boolean(nutrition.containsNuts),
            gluten: !nutrition.isGlutenFree,
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
   */
  async addIngredientToRecipe(
    productId: string,
    ingredientId: string,
    quantity: number,
  ) {
    const db = getDb();
    const now = new Date();

    return await runTransactionWithRetry(db, async (tx) => {
      await tx.insert(schema.productRecipes).values({
        id: uuidv7(),
        productId,
        ingredientId,
        quantity,
        createdAt: now,
        updatedAt: now,
        version: 1,
        syncStatus: false,
      });

      await tx
        .update(schema.products)
        .set({
          hasRecipe: true,
          updatedAt: now,
          version: sql`${schema.products.version} + 1`,
          syncStatus: false,
        })
        .where(eq(schema.products.id, productId));

      return { success: true };
    });
  },
};
