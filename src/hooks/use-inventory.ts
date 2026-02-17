import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import type { ProductFormValues } from "@/lib/validations/product";
import { ProductService } from "@/services/product.service";

export function useInventory() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 0. FETCH CURRENT USER (for Audit Logs)
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const db = getDb();
      const result = await db.select().from(schema.users).limit(1);
      return result[0] || null;
    },
  });

  // 🟢 CREATE PRODUCT
  const createProduct = useMutation({
    mutationFn: async (data: ProductFormValues) => {
      const result = await ProductService.create(data, currentUser?.id ?? null);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDialogOpen(false);
      toast.success("Produk berhasil ditambahkan");
    },
    onError: (error: Error) => {
      console.error("Failed to create product:", error);
      toast.error(error.message || "Gagal menambah produk");
    },
  });

  // 🔴 DELETE PRODUCT
  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      const result = await ProductService.delete(productId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produk berhasil dihapus (non-aktif)");
    },
    onError: (error: Error) => {
      console.error("Failed to delete product:", error);
      toast.error(error.message || "Gagal menghapus produk");
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
