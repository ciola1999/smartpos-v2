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
// 🧠 BUSINESS LOGIC: Product Service (Schema Aligned)
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

      // ⚠️ FIX: Mapping Status Enum -> Boolean isActive
      if (status) {
        if (status === "active")
          conditions.push(eq(schema.products.isActive, true));
        if (status === "inactive")
          conditions.push(eq(schema.products.isActive, false));
        // Archived biasanya ditangani via deletedAt, tapi jika logic Anda beda, sesuaikan disini
      }

      if (query) {
        conditions.push(
          or(
            like(schema.products.name, `%${query}%`),
            like(schema.products.sku, `%${query}%`),
            like(schema.products.barcode, `%${query}%`),
          )!,
        );
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

      // 1. Cek Duplikasi (SKU/Barcode)
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
        // 2. Insert Product
        // ❌ HAPUS 'productType' karena tidak ada di schema database
        // ❌ HAPUS 'attributes' karena tidak ada di schema database
        await tx.insert(schema.products).values({
          id: newId,
          branchId: branchId,

          name: data.name,
          sku: data.sku,
          barcode: data.barcode || null,
          description: data.description || "",

          // ✅ FIX: Konversi Array Images ke JSON String
          imageUrls:
            data.images.length > 0 ? JSON.stringify(data.images) : null,

          // ✅ FIX: Konversi Number ke String Decimal
          price: data.price.toString(),
          costPrice: data.costPrice.toString(),

          // Pastikan kolom ini ada (jika error, hapus baris taxId ini)
          taxId: data.taxId || null,
          categoryId: data.categoryId || null,

          unit: data.unit,
          minimumStock: data.minStock, // ✅ FIX: Mapping minStock -> minimumStock

          isActive: data.status === "active", // ✅ FIX: Mapping status -> isActive
          trackInventory: data.trackInventory,
          hasRecipe: data.hasRecipe,

          // ⚠️ PENTING: Baris 'productType' DIHAPUS karena error "does not exist"
          // productType: data.productType,

          // System Fields
          createdAt: now,
          updatedAt: now,
          version: 1,
          syncStatus: false,
        });

        // 3. Insert Initial Stock Movement
        if (data.trackInventory && data.stock > 0) {
          await tx.insert(schema.stockMovements).values({
            id: uuidv7(),
            branchId: branchId,
            warehouseId: warehouseId,
            productId: newId,
            type: "adjustment",
            quantity: data.stock,
            unitCost: data.costPrice.toString(), // ✅ FIX: Gunakan unitCost (sesuai schema umum)
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
      // Menangkap error detail dari Drizzle/SQLite
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

      // Membangun object update yang 100% Type-Safe dengan Schema
      const updatePayload: Partial<typeof schema.products.$inferInsert> = {};

      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.sku !== undefined) updatePayload.sku = data.sku;
      if (data.barcode !== undefined) updatePayload.barcode = data.barcode;
      if (data.description !== undefined)
        updatePayload.description = data.description;

      // ⚠️ FIX: JSON Stringify
      if (data.images !== undefined) {
        updatePayload.imageUrls =
          data.images.length > 0 ? JSON.stringify(data.images) : null;
      }

      if (data.categoryId !== undefined)
        updatePayload.categoryId = data.categoryId;
      if (data.taxId !== undefined) updatePayload.taxId = data.taxId;

      if (data.price !== undefined) updatePayload.price = data.price.toString();
      if (data.costPrice !== undefined)
        updatePayload.costPrice = data.costPrice.toString();

      // ⚠️ FIX: Column Mapping
      if (data.minStock !== undefined)
        updatePayload.minimumStock = data.minStock;
      if (data.status !== undefined)
        updatePayload.isActive = data.status === "active";

      if (data.trackInventory !== undefined)
        updatePayload.trackInventory = data.trackInventory;
      if (data.hasRecipe !== undefined)
        updatePayload.hasRecipe = data.hasRecipe;

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

      // ⚠️ FIX: Handle 'rowsAffected' error by checking result existence safely
      // Drizzle SQLite result varies. Safe check:
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
          isActive: false, // Set inactive
          deletedAt: now, // Set soft delete
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
          isNull(schema.categories.branchId), // Ambil kategori global juga
        ),
        orderBy: asc(schema.categories.name), // ➕ UX: Urutkan A-Z
      });

      return { success: true, data };
    } catch (error) {
      // ✅ FIX: Gunakan variabel 'error' untuk logging agar tidak kena linter
      console.error("[ProductService.getCategories] Error:", error);
      return { success: false, error: "Gagal mengambil data kategori." };
    }
  },
};
