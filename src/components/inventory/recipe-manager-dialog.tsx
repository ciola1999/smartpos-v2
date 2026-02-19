"use client";

import { useQuery } from "@tanstack/react-query";
import { isNull } from "drizzle-orm";
import {
  AlertTriangle,
  Loader2,
  Package,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as schema from "@/db/schema";
import { useRecipe } from "@/hooks/use-recipe";
import { getDb } from "@/lib/db";

interface RecipeManagerDialogProps {
  productId: string;
  trigger?: React.ReactNode; // Tombol pemicu dialog (opsional)
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * 👨‍🍳 RECIPE MANAGER UI (2026 Edition)
 * Menggabungkan Manajemen Resep dengan Analitik Finansial Real-time.
 */
export function RecipeManagerDialog({
  productId,
  trigger,
  isOpen,
  onOpenChange,
}: RecipeManagerDialogProps) {
  // 1. Logic Layer (Hook yang sudah kita buat)
  const {
    ingredients,
    productName,
    analytics,
    isLoading,
    addIngredient,
    updateQuantity,
    removeIngredient,
  } = useRecipe(productId);

  // 2. Local State untuk Form Tambah Bahan
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>("");
  const [qtyInput, setQtyInput] = useState<string>("1");

  // 3. Query Tambahan: Ambil Master Bahan Baku untuk Dropdown
  // (Idealnya ini di hook terpisah, tapi kita taruh sini agar self-contained)
  const masterIngredients = useQuery({
    queryKey: ["ingredients-master"],
    queryFn: async () => {
      const db = getDb();
      return await db
        .select({
          id: schema.ingredients.id,
          name: schema.ingredients.name,
          unit: schema.ingredients.unit,
          stock: schema.ingredients.stock,
          cost: schema.ingredients.costPerUnit,
        })
        .from(schema.ingredients)
        .where(isNull(schema.ingredients.deletedAt));
    },
  });

  // Handler: Tambah Bahan
  const handleAdd = () => {
    if (!selectedIngredientId) {
      toast.error("Pilih bahan baku terlebih dahulu");
      return;
    }

    const qty = parseFloat(qtyInput);

    // PERBAIKAN 1: Menggunakan Number.isNaN() sesuai standar Biome/ESLint
    // PERBAIKAN 2: Mengoreksi typo 'toNumber.isNaNrror' menjadi 'toast.error'
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("Jumlah harus lebih dari 0");
      return;
    }

    addIngredient.mutate({
      productId,
      ingredientId: selectedIngredientId,
      quantity: qty,
      // PERBAIKAN 3: Menghapus properti 'unit'
      // Karena di schema.ts tabel productRecipes tidak punya kolom unit
      // (kita ikut unit dari master ingredients)
    });

    // Reset Form
    setSelectedIngredientId("");
    setQtyInput("1");
  };

  // Helper: Format Rupiah
  const formatRp = (val: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* HEADER */}
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Resep & HPP:{" "}
            <span className="text-primary font-bold">{productName}</span>
          </DialogTitle>
          <DialogDescription>
            Kelola komposisi bahan baku. HPP dan margin keuntungan dihitung
            otomatis.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* 👈 KIRI: DAFTAR BAHAN (Scrollable) */}
            <div className="flex-1 flex flex-col min-h-0 border-r bg-background/50">
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Bahan Baku</TableHead>
                      <TableHead className="w-[100px]">Qty</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingredients.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-32 text-center text-muted-foreground"
                        >
                          Belum ada bahan baku. Tambahkan di bawah.
                        </TableCell>
                      </TableRow>
                    ) : (
                      ingredients.map((item) => (
                        <TableRow key={item.recipeId} className="group">
                          <TableCell>
                            <div className="font-medium">{item.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                Stok: {item.stock} {item.ingredientUnit}
                              </span>
                              {/* Logic Alert Stok */}
                              {(item.stock || 0) < item.qty && (
                                <Badge
                                  variant="destructive"
                                  className="h-5 px-1.5 text-[10px] gap-1"
                                >
                                  <AlertTriangle className="w-3 h-3" /> Kurang
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                defaultValue={item.qty}
                                className="h-8 w-16 px-2 text-right"
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (val !== item.qty && val > 0) {
                                    updateQuantity.mutate({
                                      recipeId: item.recipeId,
                                      newQty: val,
                                    });
                                  }
                                }}
                              />
                              <span className="text-xs text-muted-foreground">
                                {item.ingredientUnit}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatRp(item.totalCost)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                removeIngredient.mutate(item.recipeId)
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Form Tambah Bahan (Sticky Bottom Left) */}
              <div className="p-4 border-t bg-background">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Pilih Bahan
                    </span>
                    <Select
                      value={selectedIngredientId}
                      onValueChange={setSelectedIngredientId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Cari bahan..." />
                      </SelectTrigger>
                      <SelectContent>
                        {masterIngredients.data?.map((ing) => (
                          <SelectItem key={ing.id} value={ing.id}>
                            <div className="flex items-center justify-between w-full min-w-[200px]">
                              <span>{ing.name}</span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {formatRp(parseFloat(ing.cost || "0"))}/
                                {ing.unit}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Jumlah
                    </span>
                    <Input
                      type="number"
                      value={qtyInput}
                      onChange={(e) => setQtyInput(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <Button
                    onClick={handleAdd}
                    disabled={addIngredient.isPending}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 👉 KANAN: ANALITIK INTELLIGENCE PANEL */}
            <div className="w-full md:w-[320px] bg-muted/10 p-6 flex flex-col gap-6">
              {/* Card 1: Profitability */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Analisa Profit
                </h3>

                <div className="bg-background border rounded-lg p-4 shadow-sm space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Harga Jual</span>
                    <span className="font-semibold">
                      {formatRp(analytics.sellingPrice)}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      Total HPP (COGS)
                    </span>
                    <span className="font-mono text-red-600 font-medium">
                      - {formatRp(analytics.totalCost)}
                    </span>
                  </div>

                  <div
                    className={`p-3 rounded-md flex justify-between items-center ${
                      analytics.isProfitable
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold uppercase opacity-80">
                        Gross Profit
                      </div>
                      <div className="font-bold text-lg">
                        {formatRp(analytics.grossProfit)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold uppercase opacity-80">
                        Margin
                      </div>
                      <div className="font-bold text-lg">
                        {analytics.marginPercent}%
                      </div>
                    </div>
                  </div>

                  {/* Visual Progress Bar Margin */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Cost Ratio</span>
                      <span>Target: &lt;70%</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          (analytics.totalCost / analytics.sellingPrice) > 0.8
                            ? "bg-red-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.min((analytics.totalCost / (analytics.sellingPrice || 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Operational Health */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Status Operasional
                </h3>

                {analytics.isStockCritical ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                    <div className="font-bold flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4" /> Stok Kritis!
                    </div>
                    <p className="opacity-90">
                      Beberapa bahan baku memiliki stok kurang dari kebutuhan
                      resep ini. Produksi mungkin terhambat.
                    </p>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
                    <div className="font-bold flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4" /> Stok Aman
                    </div>
                    <p className="opacity-90">
                      Semua bahan baku tersedia di gudang untuk produksi.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
