import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { ProductFormValues } from "@/lib/validations/product";
import { ProductService } from "@/services/product.service";

// ─────────────────────────────────────────────────────────────────────────────
// 🔑 QUERY KEYS MANAGEMENT
// Mengelola key cache agar terstruktur dan mudah di-invalidate
// ─────────────────────────────────────────────────────────────────────────────
export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (branchId: string, params: Record<string, unknown>) =>
    [...productKeys.lists(), branchId, params] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detail: (branchId: string, productId: string) =>
    [...productKeys.details(), branchId, productId] as const,
  categories: (branchId: string) =>
    [...productKeys.all, "categories", branchId] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// 🎣 FETCH HOOKS (READ)
// ─────────────────────────────────────────────────────────────────────────────

interface UseProductsParams {
  branchId: string;
  page?: number;
  limit?: number;
  query?: string;
  categoryId?: string;
  status?: "active" | "inactive" | "archived";
}

export function useProducts({ branchId, ...params }: UseProductsParams) {
  return useQuery({
    queryKey: productKeys.list(branchId, params as Record<string, unknown>),
    queryFn: async () => {
      const res = await ProductService.getAll(branchId, params);
      if (!res.success) throw new Error(res.error || "Gagal memuat produk");
      return res; // Return full response untuk akses meta (pagination)
    },
    placeholderData: keepPreviousData, // UX: Mencegah kedip saat ganti halaman
    staleTime: 1000 * 60 * 1, // Cache data selama 1 menit
  });
}

export function useProduct(branchId: string, productId: string) {
  return useQuery({
    queryKey: productKeys.detail(branchId, productId),
    queryFn: async () => {
      const res = await ProductService.getById(branchId, productId);
      if (!res.success || !res.data)
        throw new Error(res.error || "Produk tidak ditemukan");
      return res.data;
    },
    enabled: !!productId && !!branchId, // Hanya jalan jika ID tersedia
  });
}

// ⚠️ Bonus: Hook untuk Kategori (Dropdown)
export function useCategories(branchId: string) {
  return useQuery({
    queryKey: productKeys.categories(branchId),
    queryFn: async () => {
      // Pastikan Anda mengekspos getCategories di ProductService
      // Jika belum, tambahkan di service (lihat note di bawah)
      const res = await ProductService.getCategories(branchId);
      if (!res.success) throw new Error(res.error);
      return res.data || [];
    },
    staleTime: 1000 * 60 * 30, // Kategori jarang berubah (30 min cache)
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ⚡ MUTATION HOOKS (WRITE)
// ─────────────────────────────────────────────────────────────────────────────

export function useProductMutations(branchId: string) {
  const queryClient = useQueryClient();

  // 1. CREATE
  const createProduct = useMutation({
    mutationFn: async (variables: {
      warehouseId: string;
      data: ProductFormValues;
      userId: string;
    }) => {
      const res = await ProductService.create(
        branchId,
        variables.warehouseId,
        variables.data,
        variables.userId,
      );
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Produk berhasil ditambahkan");
      // Invalidate list agar data baru muncul
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
    onError: (error) => {
      toast.error(error.message || "Gagal menambah produk");
    },
  });

  // 2. UPDATE
  const updateProduct = useMutation({
    mutationFn: async (variables: {
      productId: string;
      data: Partial<ProductFormValues>;
      userId: string;
    }) => {
      const res = await ProductService.update(
        branchId,
        variables.productId,
        variables.data,
        variables.userId,
      );
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: (_, variables) => {
      toast.success("Produk berhasil diperbarui");
      // Invalidate detail produk spesifik & list utama
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(branchId, variables.productId),
      });
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
    onError: (error) => {
      toast.error(error.message || "Gagal update produk");
    },
  });

  // 3. DELETE (ARCHIVE)
  const deleteProduct = useMutation({
    mutationFn: async (variables: { productId: string; userId: string }) => {
      const res = await ProductService.delete(
        branchId,
        variables.productId,
        variables.userId,
      );
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      toast.success("Produk dihapus (diarsipkan)");
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
    onError: (error) => {
      toast.error(error.message || "Gagal menghapus produk");
    },
  });

  return {
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
