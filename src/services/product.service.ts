import {
  and,
  asc,
  desc,
  eq,
  isNull,
  like,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import * as schema from "@/db/schema";
import { getDb, runTransactionWithRetry } from "@/lib/db";
import type { ProductFormValues } from "@/lib/validations/product";

// ─────────────────────────────────────────────────────────────────────────────
// 📝 TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export type ProductSelect = typeof schema.products.$inferSelect;

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface ProductQueryParams {
  query?: string;
  categoryId?: string;
  status?: "active" | "inactive" | "archived";
  page?: number;
  limit?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapping dasar: nama, sku, barcode, deskripsi, kategori, pajak.
 */
function mapBasicInfo(
  data: Partial<ProductFormValues>,
  payload: Partial<typeof schema.products.$inferInsert>,
) {
  if (data.name !== undefined) payload.name = data.name;
  if (data.sku !== undefined) payload.sku = data.sku;
  if (data.barcode !== undefined) payload.barcode = data.barcode;
  if (data.description !== undefined) payload.description = data.description;
  if (data.categoryId !== undefined) payload.categoryId = data.categoryId;
  if (data.taxId !== undefined) payload.taxId = data.taxId;
  if (data.status !== undefined) payload.isActive = data.status === "active";
}

/**
 * Mapping finansial: harga jual dan harga beli.
 */
function mapPricing(
  data: Partial<ProductFormValues>,
  payload: Partial<typeof schema.products.$inferInsert>,
) {
  if (data.price !== undefined) payload.price = data.price.toString();
  if (data.costPrice !== undefined)
    payload.costPrice = data.costPrice.toString();
}

/**
 * Mapping inventory & unit.
 */
function mapInventorySettings(
  data: Partial<ProductFormValues>,
  payload: Partial<typeof schema.products.$inferInsert>,
) {
  if (data.unit !== undefined) payload.unit = data.unit;
  if (data.valuationMethod !== undefined)
    payload.valuationMethod = data.valuationMethod;
  if (data.minStock !== undefined) payload.minimumStock = data.minStock;
  if (data.maxStock !== undefined) payload.maximumStock = data.maxStock;
  if (data.trackInventory !== undefined)
    payload.trackInventory = data.trackInventory;
  if (data.hasRecipe !== undefined) payload.hasRecipe = data.hasRecipe;
}

/**
 * Mapping atribut fisik: berat dan dimensi.
 */
function mapPhysicalAttributes(
  data: Partial<ProductFormValues>,
  payload: Partial<typeof schema.products.$inferInsert>,
) {
  if (data.weight !== undefined) payload.weight = data.weight;
  if (data.weightUnit !== undefined) payload.weightUnit = data.weightUnit;
  if (data.dimensions !== undefined) {
    payload.dimensions = data.dimensions
      ? JSON.stringify(data.dimensions)
      : null;
  }
}

/**
 * Mappings manual dari ProductFormValues ke DB Schema.
 */
function mapProductFormToSchema(
  data: Partial<ProductFormValues>,
): Partial<typeof schema.products.$inferInsert> {
  const payload: Partial<typeof schema.products.$inferInsert> = {};

  mapBasicInfo(data, payload);
  mapPricing(data, payload);
  mapInventorySettings(data, payload);
  mapPhysicalAttributes(data, payload);

  if (data.images !== undefined) {
    payload.imageUrls =
      data.images.length > 0 ? JSON.stringify(data.images) : null;
  }

  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 BUSINESS LOGIC: Product Service
// ─────────────────────────────────────────────────────────────────────────────

export const ProductService = {
  getAll: async (
    branchId: string,
    params: ProductQueryParams,
  ): Promise<ServiceResponse<ProductSelect[]>> => {
    try {
      const db = await getDb();
      const { query, categoryId, status, page = 1, limit = 10 } = params;
      const offset = (page - 1) * limit;

      const conditions: SQL[] = [
        eq(schema.products.branchId, branchId),
        isNull(schema.products.deletedAt),
      ];

      if (status) {
        if (status === "active")
          conditions.push(eq(schema.products.isActive, true));
        if (status === "inactive")
          conditions.push(eq(schema.products.isActive, false));
      }

      if (query) {
        const searchFilter = or(
          like(schema.products.name, `%${query}%`),
          like(schema.products.sku, `%${query}%`),
          like(schema.products.barcode, `%${query}%`),
        );
        if (searchFilter) conditions.push(searchFilter);
      }

      if (categoryId && categoryId !== "all") {
        conditions.push(eq(schema.products.categoryId, categoryId));
      }

      const whereClause = and(...conditions);

      const data = await db
        .select()
        .from(schema.products)
        .where(whereClause)
        .orderBy(desc(schema.products.createdAt))
        .limit(limit)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.products)
        .where(whereClause);

      const total = countResult[0]?.count || 0;

      return {
        success: true,
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("[ProductService.getAll] Error:", error);
      return { success: false, error: "Gagal memuat data produk." };
    }
  },

  create: async (
    branchId: string,
    warehouseId: string,
    data: ProductFormValues,
    userId: string,
  ): Promise<ServiceResponse<string>> => {
    try {
      const db = await getDb();
      const newId = uuidv7();
      const now = new Date();

      const existing = await db.query.products.findFirst({
        where: and(
          eq(schema.products.branchId, branchId),
          or(
            eq(schema.products.sku, data.sku),
            data.barcode
              ? eq(schema.products.barcode, data.barcode)
              : undefined,
          ),
          isNull(schema.products.deletedAt),
        ),
      });

      if (existing) {
        if (existing.sku === data.sku)
          return {
            success: false,
            error: `SKU '${data.sku}' sudah digunakan.`,
          };
        if (existing.barcode === data.barcode)
          return {
            success: false,
            error: `Barcode '${data.barcode}' sudah digunakan.`,
          };
      }

      await runTransactionWithRetry(db, async (tx) => {
        await tx.insert(schema.products).values({
          id: newId,
          branchId: branchId,
          name: data.name,
          sku: data.sku,
          barcode: data.barcode || null,
          description: data.description || "",
          imageUrls:
            data.images.length > 0 ? JSON.stringify(data.images) : null,
          price: data.price.toString(),
          costPrice: data.costPrice.toString(),
          taxId: data.taxId || null,
          categoryId: data.categoryId || null,
          unit: data.unit,
          valuationMethod: data.valuationMethod,
          minimumStock: data.minStock,
          maximumStock: data.maxStock || null,
          weight: data.weight || null,
          weightUnit: data.weightUnit,
          dimensions: data.dimensions ? JSON.stringify(data.dimensions) : null,
          isActive: data.status === "active",
          trackInventory: data.trackInventory,
          hasRecipe: data.hasRecipe,
          createdAt: now,
          updatedAt: now,
          version: 1,
          syncStatus: false,
        });

        if (data.trackInventory && data.stock > 0) {
          await tx.insert(schema.stockMovements).values({
            id: uuidv7(),
            branchId: branchId,
            warehouseId: warehouseId,
            productId: newId,
            type: "adjustment",
            quantity: data.stock,
            unitCost: data.costPrice.toString(),
            referenceType: "manual_adjustment",
            note: "Inisialisasi Produk Baru",
            userId: userId,
            createdAt: now,
            version: 1,
            syncStatus: false,
          });
        }
      });

      return { success: true, data: newId };
    } catch (error) {
      console.error("[ProductService.create] Error:", error);
      if (error instanceof Error) {
        return {
          success: false,
          error: `Gagal membuat produk: ${error.message}`,
        };
      }
      return { success: false, error: "Gagal membuat produk." };
    }
  },

  update: async (
    branchId: string,
    productId: string,
    data: Partial<ProductFormValues>,
    _userId: string,
  ): Promise<ServiceResponse<void>> => {
    try {
      const db = await getDb();
      const now = new Date();

      const updatePayload = mapProductFormToSchema(data);
      updatePayload.updatedAt = now;
      updatePayload.syncStatus = false;
      updatePayload.version =
        sql`${schema.products.version} + 1` as unknown as number;

      const result = await db
        .update(schema.products)
        .set(updatePayload)
        .where(
          and(
            eq(schema.products.id, productId),
            eq(schema.products.branchId, branchId),
          ),
        );

      if (!result) {
        return { success: false, error: "Gagal update (No Result)." };
      }

      return { success: true };
    } catch (error) {
      console.error("[ProductService.update] Error:", error);
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return { success: false, error: "SKU atau Barcode sudah dipakai." };
      }
      return { success: false, error: "Gagal update produk." };
    }
  },

  delete: async (
    branchId: string,
    productId: string,
    _userId: string,
  ): Promise<ServiceResponse<void>> => {
    try {
      const db = await getDb();
      const now = new Date();

      await db
        .update(schema.products)
        .set({
          isActive: false,
          deletedAt: now,
          updatedAt: now,
          version: sql`${schema.products.version} + 1` as unknown as number,
          syncStatus: false,
        })
        .where(
          and(
            eq(schema.products.id, productId),
            eq(schema.products.branchId, branchId),
          ),
        );

      return { success: true };
    } catch (error) {
      console.error("[ProductService.delete] Error:", error);
      return { success: false, error: "Gagal menghapus produk." };
    }
  },

  getById: async (branchId: string, productId: string) => {
    const db = await getDb();
    const product = await db.query.products.findFirst({
      where: and(
        eq(schema.products.id, productId),
        eq(schema.products.branchId, branchId),
      ),
      with: {
        category: true,
      },
    });
    return product
      ? { success: true, data: product }
      : { success: false, error: "Not found" };
  },

  getCategories: async (
    branchId: string,
  ): Promise<ServiceResponse<(typeof schema.categories.$inferSelect)[]>> => {
    try {
      const db = await getDb();

      const data = await db.query.categories.findMany({
        where: or(
          eq(schema.categories.branchId, branchId),
          isNull(schema.categories.branchId),
        ),
        orderBy: asc(schema.categories.name),
      });

      return { success: true, data };
    } catch (error) {
      console.error("[ProductService.getCategories] Error:", error);
      return { success: false, error: "Gagal mengambil data kategori." };
    }
  },
};
