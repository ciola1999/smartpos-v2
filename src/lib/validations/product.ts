import { z } from "zod";

export const ProductFormSchema = z.object({
  name: z.string().min(3, "Nama produk minimal 3 karakter"),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"), // coerce menangani string -> number input
  stock: z.coerce.number().min(0, "Stok tidak boleh negatif"),
  sku: z.string().optional(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  // Cost price penting untuk laporan laba rugi nanti
  costPrice: z.coerce.number().min(0).default(0),
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;
