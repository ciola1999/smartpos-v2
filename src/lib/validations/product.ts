import { z } from "zod";

export const ProductFormSchema = z.object({
  // 📝 Basic Info
  name: z.string().min(1, "Nama produk wajib diisi"),
  sku: z.string().min(1, "SKU wajib diisi"),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().default(""),

  // 📸 Images: Input array string -> nanti di-convert ke string JSON di Service
  images: z.array(z.string()).default([]),

  // 🔗 Relations
  categoryId: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),

  // 💰 Financials
  price: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),

  // 📦 Inventory Logic
  productType: z.enum(["simple", "variable"]).default("simple"),
  unit: z.string().default("pcs"),

  // ⚠️ MAPPING: Form 'minStock' -> DB 'minimumStock'
  minStock: z.coerce.number().default(0),
  stock: z.coerce.number().default(0), // Stok awal

  trackInventory: z.boolean().default(true),
  hasRecipe: z.boolean().default(false),

  // ⚠️ MAPPING: Form 'status' -> DB 'isActive'
  status: z.enum(["active", "inactive", "archived"]).default("active"),

  // Attributes (Hanya untuk keperluan UI/Variant generation, tidak masuk tabel products)
  attributes: z.record(z.string(), z.string()).optional().default({}),
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;
