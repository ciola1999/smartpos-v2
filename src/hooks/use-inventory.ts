import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type AdjustStockInput,
  InventoryService,
} from "@/services/inventory.service";

// --- TYPES & INTERFACES ---

/**
 * Target Inventory: Bisa berupa Produk atau Bahan Baku
 * Digunakan untuk menstandarisasi input ke Hooks
 */
export type InventoryTarget = {
  productId?: string | null;
  ingredientId?: string | null;
  variantId?: string | null;
};

// --- KEYS CONSTANTS (Cache Management System) ---

export const INVENTORY_KEYS = {
  all: ["inventory"] as const,
  stock: (target: InventoryTarget, warehouseId?: string) =>
    [...INVENTORY_KEYS.all, "stock", { ...target }, warehouseId] as const,
  history: (target: InventoryTarget, warehouseId?: string) =>
    [...INVENTORY_KEYS.all, "history", { ...target }, warehouseId] as const,
};

/**
 * ⚡️ HOOK INVENTARIS ENTERPRISE (2026)
 * Mendukung: Produk, Varian, Bahan Baku, Multi-Gudang, dan Optimistic UI
 */
export function useInventory() {
  const queryClient = useQueryClient();

  // --- 1. QUERIES (Data Fetching) ---

  const useCurrentStock = (target: InventoryTarget, warehouseId?: string) => {
    const isEnabled = !!(target.productId || target.ingredientId);

    return useQuery({
      queryKey: INVENTORY_KEYS.stock(target, warehouseId),
      queryFn: async () => {
        if (!isEnabled) return 0;

        // 🛠️ FIX: Sanitasi input (Convert null -> undefined)
        // Service mengharapkan { productId?: string }, bukan { productId?: string | null }
        const serviceTarget = {
          productId: target.productId ?? undefined,
          ingredientId: target.ingredientId ?? undefined,
          variantId: target.variantId, // variantId biasanya boleh null di DB
        };

        return InventoryService.getCurrentStock(serviceTarget, warehouseId);
      },
      enabled: isEnabled,
      staleTime: 1000 * 30,
    });
  };

  const useStockHistory = (target: InventoryTarget, warehouseId?: string) => {
    const isEnabled = !!(target.productId || target.ingredientId);

    return useQuery({
      queryKey: INVENTORY_KEYS.history(target, warehouseId),
      queryFn: async () => {
        if (!isEnabled) return [];

        // 🛠️ FIX: Sanitasi input di sini juga
        const serviceTarget = {
          productId: target.productId ?? undefined,
          ingredientId: target.ingredientId ?? undefined,
        };

        const result = await InventoryService.getHistory(
          serviceTarget,
          warehouseId,
        );
        if (!result.success) throw new Error(result.error);
        return result.data;
      },
      enabled: isEnabled,
    });
  };

  // --- 2. MUTATIONS (Data Changing) ---

  const adjustStockMutation = useMutation({
    mutationFn: async ({
      input,
      userId,
    }: {
      input: AdjustStockInput;
      userId: string;
    }) => {
      const result = await InventoryService.adjustStock(input, userId);
      if (!result.success)
        throw new Error(result.message || "Gagal mengubah stok");
      return result;
    },

    onMutate: async ({ input }) => {
      // Konstruksi Target Key
      const target: InventoryTarget = {
        productId: input.productId,
        ingredientId: input.ingredientId,
        variantId: input.variantId,
      };

      const stockKey = INVENTORY_KEYS.stock(target, input.warehouseId);
      const historyKey = INVENTORY_KEYS.history(target, input.warehouseId);

      await queryClient.cancelQueries({ queryKey: stockKey });
      await queryClient.cancelQueries({ queryKey: historyKey });

      const previousStock = queryClient.getQueryData<number>(stockKey);

      queryClient.setQueryData<number>(stockKey, (oldStock = 0) => {
        let delta = 0;
        switch (input.type) {
          case "restock":
          case "production":
            delta = input.quantity;
            break;
          case "damage":
          case "void":
            delta = -input.quantity;
            break;
          case "correction":
            return input.quantity; // Smart replace
        }
        return oldStock + delta;
      });

      return { previousStock, stockKey, historyKey };
    },

    onError: (err, _, context) => {
      if (context?.previousStock !== undefined) {
        queryClient.setQueryData(context.stockKey, context.previousStock);
      }
      toast.error(`Gagal update stok: ${err.message}`);
    },

    onSettled: (_, __, { input }, ___) => {
      const target: InventoryTarget = {
        productId: input.productId,
        ingredientId: input.ingredientId,
        variantId: input.variantId,
      };

      queryClient.invalidateQueries({
        queryKey: INVENTORY_KEYS.stock(target, input.warehouseId),
      });
      queryClient.invalidateQueries({
        queryKey: INVENTORY_KEYS.history(target, input.warehouseId),
      });

      if (input.productId)
        queryClient.invalidateQueries({ queryKey: ["products"] });
      if (input.ingredientId)
        queryClient.invalidateQueries({ queryKey: ["ingredients"] });
    },

    onSuccess: (data) => {
      toast.success(data.message ?? "Stok berhasil diperbarui");
    },
  });

  return {
    useCurrentStock,
    useStockHistory,
    adjustStock: adjustStockMutation.mutateAsync,
    isAdjusting: adjustStockMutation.isPending,
  };
}
