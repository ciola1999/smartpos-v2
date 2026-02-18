import { and, asc, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import * as schema from "@/db/schema";
import { getDb, runTransactionWithRetry } from "@/lib/db";
import {
  ProductFormSchema,
  type ProductFormValues,
} from "@/lib/validations/product";

export const ProductService = {
  // --- READ ---
  getAll: async (query?: string) => {
    try {
      const db = await getDb();

      const searchFilter = query
        ? or(
            like(schema.products.name, `%${query}%`),
            like(schema.products.sku, `%${query}%`),
            like(schema.products.barcode, `%${query}%`),
          )
        : undefined;

      const whereCondition = and(
        eq(schema.products.isActive, true),
        isNull(schema.products.deletedAt),
        searchFilter,
      );

      const data = await db
        .select()
        .from(schema.products)
        .where(whereCondition)
        .orderBy(desc(schema.products.createdAt));

      return { success: true, data };
    } catch (error) {
      console.error("ProductService.getAll Error:", error);
      return { success: false, error: "Gagal mengambil data produk." };
    }
  },

  // --- CATEGORIES ---
  getCategories: async () => {
    try {
      const db = await getDb();
      const data = await db
        .select()
        .from(schema.categories)
        .where(isNull(schema.categories.deletedAt))
        .orderBy(asc(schema.categories.name));

      return { success: true, data };
    } catch (error) {
      console.error("ProductService.getCategories Error:", error);
      return { success: false, error: "Gagal mengambil data kategori." };
    }
  },

  // --- CREATE ---
  create: async (rawInput: ProductFormValues, userId: string | null = null) => {
    try {
      const validated = ProductFormSchema.parse(rawInput);
      const newId = uuidv7();
      const now = new Date();
      const db = await getDb();

      await runTransactionWithRetry(db, async (tx) => {
        await tx.insert(schema.products).values({
          id: newId,
          name: validated.name,
          categoryId: validated.categoryId || null, // FK must be null if empty
          sku: validated.sku || `SKU-${Date.now()}`, // Unique
          barcode: validated.barcode || null, // Unique (empty string would conflict)
          imageUrl: validated.imageUrl || "", // Text can be empty string
          description: validated.description || "", // Text can be empty string

          price: validated.price.toString(),
          costPrice: validated.costPrice.toString(),

          stock: validated.stock,
          unit: validated.unit,
          minStock: validated.minStock,

          isActive: true,
          hasRecipe: false, // Explicit Default
          createdAt: now,
          updatedAt: now,
          version: 1,
          syncStatus: false,
        });

        if (validated.stock > 0) {
          await tx.insert(schema.stockMovements).values({
            id: uuidv7(),
            productId: newId,
            quantity: validated.stock,
            type: "adjustment",
            referenceType: "adjustment",
            note: "Initial Stock Setup",
            userId: userId,
            createdAt: now,
            updatedAt: now,
            version: 1,
            syncStatus: false,
          });
        }
      });

      return { success: true, data: newId };
    } catch (error) {
      console.error("ProductService.create Error:", error);
      if (error instanceof Error) {
        if (error.message.includes("UNIQUE constraint failed")) {
          return { success: false, error: "SKU atau Barcode sudah terdaftar." };
        }
      }
      return { success: false, error: "Gagal membuat produk." };
    }
  },

  // --- UPDATE ---
  update: async (id: string, rawInput: Partial<ProductFormValues>) => {
    try {
      const db = await getDb();
      const now = new Date();

      const updateData: Partial<typeof schema.products.$inferInsert> = {
        name: rawInput.name,
        categoryId: rawInput.categoryId ?? null,
        sku: rawInput.sku,
        barcode: rawInput.barcode,
        imageUrl: rawInput.imageUrl,
        unit: rawInput.unit,
        minStock: rawInput.minStock,
        price:
          rawInput.price !== undefined ? rawInput.price.toString() : undefined,
        costPrice:
          rawInput.costPrice !== undefined
            ? rawInput.costPrice.toString()
            : undefined,
        description: rawInput.description,
        updatedAt: now,
        version: sql`${schema.products.version} + 1` as unknown as number, // Bypass strict type check
        syncStatus: false,
      };

      // Filter out undefined values
      const finalUpdateData = Object.keys(updateData).reduce(
        (acc, key) => {
          const val = updateData[key as keyof typeof updateData];
          if (val !== undefined) {
            acc[key] = val;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      ) as Partial<typeof schema.products.$inferInsert>;

      await db
        .update(schema.products)
        .set(finalUpdateData)
        .where(eq(schema.products.id, id));

      return { success: true };
    } catch (error) {
      console.error("ProductService.update Error:", error);
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return { success: false, error: "SKU atau Barcode konflik." };
      }
      return { success: false, error: "Gagal update produk." };
    }
  },

  // --- DELETE ---
  delete: async (id: string) => {
    try {
      const db = await getDb();
      const now = new Date();

      await db
        .update(schema.products)
        .set({
          isActive: false,
          deletedAt: now,
          updatedAt: now,
          version: sql`${schema.products.version} + 1`,
          syncStatus: false,
        })
        .where(eq(schema.products.id, id));

      return { success: true };
    } catch (error) {
      console.error("ProductService.delete Error:", error);
      return { success: false, error: "Gagal menghapus produk." };
    }
  },

  getById: async (id: string) => {
    const db = await getDb();
    const result = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);
    return result[0] || null;
  },
};
