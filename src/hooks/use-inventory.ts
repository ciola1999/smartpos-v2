import { useMutation, useQueryClient } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import { useState } from "react";
import { v7 as uuidv7 } from "uuid";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import type { ProductFormValues } from "@/lib/validations/product";

export function useInventory() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 🟢 CREATE PRODUCT
  const createProduct = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const db = getDb();
      const id = uuidv7();
      const now = new Date();

      await db.insert(schema.products).values({
        id: id,
        name: data.name,
        // Konversi number ke string sesuai Schema Drizzle Anda
        price: data.price.toString(),
        costPrice: data.costPrice.toString(),
        stock: data.stock,
        sku: data.sku || `SKU-${Date.now()}`, // Auto-generate SKU sederhana
        isActive: true,
        createdAt: now,
        updatedAt: now,
        version: 1,
        syncStatus: false,
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDialogOpen(false);
      // toast.success("Produk berhasil ditambahkan");
    },
    onError: (error) => {
      console.error("Failed to create product:", error);
      // toast.error("Gagal menambah produk");
    },
  });

  // 🔴 DELETE PRODUCT
  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      const db = getDb();
      // Hard delete untuk MVP.
      // Note: Idealnya cek dulu apakah produk sudah ada di transaksi (orders).
      // Jika sudah ada orders, sebaiknya gunakan Soft Delete (isActive: false)
      await db.delete(schema.products).where(eq(schema.products.id, productId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // toast.success("Produk dihapus");
    },
  });

  return {
    // State
    isDialogOpen,
    setIsDialogOpen,

    // Actions
    createProduct: createProduct.mutateAsync,
    isCreating: createProduct.isPending,

    deleteProduct: deleteProduct.mutateAsync,
    isDeleting: deleteProduct.isPending,
  };
}
