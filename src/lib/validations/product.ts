import { z } from "zod";

export const ProductFormSchema = z.object({
  // 📝 Basic Info
  name: z.string().min(1, "Nama produk wajib diisi"),
  sku: z.string().min(1, "SKU wajib diisi"),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().default(""),

  // 📸 Images
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
  valuationMethod: z.enum(["fifo", "lifo", "average"]).default("fifo"),

  // ⚠️ MAPPING: Form -> DB
  minStock: z.coerce.number().default(0),
  maxStock: z.coerce.number().optional().nullable(),
  stock: z.coerce.number().default(0),

  trackInventory: z.boolean().default(true),
  hasRecipe: z.boolean().default(false),

  // Physical Attributes
  weight: z.coerce.number().optional().nullable(),
  weightUnit: z.string().default("kg"),
  dimensions: z
    .object({
      length: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      unit: z.string().default("cm"),
    })
    .optional()
    .nullable(),

  // ⚠️ MAPPING: Form 'status' -> DB 'isActive'
  status: z.enum(["active", "inactive", "archived"]).default("active"),

  // Attributes
  attributes: z.record(z.string(), z.string()).optional().default({}),
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;
