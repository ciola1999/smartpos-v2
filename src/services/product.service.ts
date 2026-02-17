import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
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

  // --- CREATE ---
  create: async (rawInput: ProductFormValues, userId: string = "system") => {
    try {
      const validated = ProductFormSchema.parse(rawInput);
      const newId = uuidv7();
      const now = new Date();
      const db = await getDb();

      await db.transaction(async (tx) => {
        await tx.insert(schema.products).values({
          id: newId,
          name: validated.name,
          categoryId: validated.categoryId ?? null,
          sku: validated.sku || `SKU-${Date.now()}`,
          // barcode: validated.barcode || null,

          price: validated.price.toString(),
          costPrice: validated.costPrice.toString(),

          stock: validated.stock,
          // unit: validated.unit || "pcs",

          isActive: true,
          createdAt: now,
          updatedAt: now,
          version: 1,
          syncStatus: false,
        });

        if (validated.stock > 0) {
          await tx.insert(schema.inventoryLogs).values({
            id: uuidv7(),
            productId: newId,
            changeAmount: validated.stock,
            finalStock: validated.stock,
            type: "correction",
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
        // barcode: rawInput.barcode,
        price:
          rawInput.price !== undefined ? rawInput.price.toString() : undefined,
        costPrice:
          rawInput.costPrice !== undefined
            ? rawInput.costPrice.toString()
            : undefined,
        updatedAt: now,
        version: sql`${schema.products.version} + 1` as unknown as number,
        syncStatus: false,
      };

      // 🛠️ FIX: Clean undefined values safely
      const finalUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined),
      );

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
