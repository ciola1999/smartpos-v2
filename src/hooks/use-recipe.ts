import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import { toast } from "sonner";
import type { z } from "zod";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import {
  type RecipeMutationSchema,
  RecipeService,
} from "@/services/recipe.service";

/**
 * 🥘 USE RECIPE INTELLIGENCE
 * Mengelola resep dengan analitik profitabilitas real-time dan validasi stok.
 */
export function useRecipe(productId: string) {
  const queryClient = useQueryClient();
  const RECIPE_KEY = ["recipe", productId];
  const PRODUCT_KEY = ["product", productId];

  // 1. 📥 QUERY: Ambil Data Resep (Ingredients List)
  const recipeQuery = useQuery({
    queryKey: RECIPE_KEY,
    queryFn: () => RecipeService.getProductRecipe(productId),
    enabled: !!productId,
    staleTime: 0,
  });

  // 2. 📥 QUERY: Ambil Data Produk (Untuk Harga Jual & Profit Analysis)
  // Kita butuh harga jual (price) untuk menghitung margin secara live
  const productQuery = useQuery({
    queryKey: PRODUCT_KEY,
    queryFn: async () => {
      const db = getDb();
      const res = await db
        .select({
          price: schema.products.price,
          name: schema.products.name,
          costPrice: schema.products.costPrice,
        })
        .from(schema.products)
        .where(eq(schema.products.id, productId))
        .limit(1);
      return res[0];
    },
    enabled: !!productId,
    staleTime: 0,
  });

  // 3. 🧠 COMPUTED METRICS (Financial & Operational Intelligence)
  const ingredients = recipeQuery.data || [];
  const product = productQuery.data;

  // Hitung Total HPP (Cost of Goods Sold) dari resep saat ini
  const currentTotalCost = ingredients.reduce(
    (acc, item) => acc + (item.totalCost || 0),
    0,
  );

  // Analisa Profitabilitas
  const sellingPrice = parseFloat(product?.price || "0");
  const grossProfit = sellingPrice - currentTotalCost;
  const marginPercent =
    sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

  // Analisa Operasional (Stok Alert)
  // Cek apakah ada bahan yang stoknya kurang dari kebutuhan resep
  const stockAlerts = ingredients.filter(
    (item) => (item.stock || 0) < item.qty,
  );
  const isStockCritical = stockAlerts.length > 0;

  // 4. ⚡ MUTATIONS (Smart Updates)

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: RECIPE_KEY });
    queryClient.invalidateQueries({ queryKey: PRODUCT_KEY }); // Update margin produk
    queryClient.invalidateQueries({ queryKey: ["products"] }); // Update list global
  };

  // Tambah Bahan
  const addIngredient = useMutation({
    mutationFn: (data: z.infer<typeof RecipeMutationSchema>) =>
      RecipeService.addIngredient(data),
    onSuccess: () => {
      toast.success("Bahan ditambahkan. HPP diperbarui.");
      invalidateAll();
    },
    onError: (err) => toast.error(`Gagal: ${err.message}`),
  });

  // Update Takaran
  const updateQuantity = useMutation({
    mutationFn: ({ recipeId, newQty }: { recipeId: string; newQty: number }) =>
      RecipeService.updateIngredientQty(recipeId, productId, newQty),
    onSuccess: () => invalidateAll(), // Silent success untuk UX cepat
    onError: (err) => toast.error(`Gagal update: ${err.message}`),
  });

  // Hapus Bahan
  const removeIngredient = useMutation({
    mutationFn: (recipeId: string) =>
      RecipeService.removeIngredient(recipeId, productId),
    onSuccess: () => {
      toast.success("Bahan dihapus.");
      invalidateAll();
    },
    onError: (err) => toast.error(`Gagal hapus: ${err.message}`),
  });

  return {
    // Data Utama
    ingredients,
    productName: product?.name || "Loading...",

    // Status Loading
    isLoading: recipeQuery.isLoading || productQuery.isLoading,
    isError: recipeQuery.isError || productQuery.isError,

    // 📊 INTELLIGENCE DASHBOARD DATA
    // Data ini siap dipakai UI untuk menampilkan Badge/Alert/Chart
    analytics: {
      totalCost: currentTotalCost,
      sellingPrice,
      grossProfit,
      marginPercent: marginPercent.toFixed(1), // String "45.2"
      isProfitable: grossProfit > 0,

      // Inventory Health
      stockAlerts, // List bahan yang stoknya kurang
      isStockCritical, // Boolean untuk trigger warna merah di UI
    },

    // Actions
    addIngredient,
    updateQuantity,
    removeIngredient,
  };
}
