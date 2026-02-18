"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type InventoryTarget, useInventory } from "@/hooks/use-inventory";
import { adjustStockSchema } from "@/services/inventory.service";

// Schema Form (Subset dari schema service)
// Kita extend sedikit agar compatible dengan react-hook-form (handling numbers)
const formSchema = adjustStockSchema;

type FormValues = z.infer<typeof formSchema>;

interface AdjustStockDialogProps {
  target: InventoryTarget; // Bisa Product atau Ingredient
  itemName: string; // Nama barang untuk judul dialog
  warehouseId: string; // Wajib
  userId: string; // Dari session
}

export function AdjustStockDialog({
  target,
  itemName,
  warehouseId,
  userId,
}: AdjustStockDialogProps) {
  const [open, setOpen] = useState(false);
  const { adjustStock, isAdjusting } = useInventory();

  // Setup Form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: target.productId ?? undefined,
      ingredientId: target.ingredientId ?? undefined,
      variantId: target.variantId,
      warehouseId: warehouseId,
      type: "restock",
      quantity: 0,
      unitCost: 0,
      note: "",
      referenceId: "",
    },
  });

  const watchType = form.watch("type");

  const onSubmit = async (values: FormValues) => {
    try {
      await adjustStock({ input: values, userId });
      setOpen(false);
      form.reset();
    } catch (error) {
      // Error handled by hook toast, but we keep this specifically for form logic errors
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Update Stok
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Stok: {itemName}</DialogTitle>
          <DialogDescription>
            Lakukan penyesuaian stok untuk gudang terpilih.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 1. TIPE ADJUSTMENT */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe Transaksi</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih tipe" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="restock">
                        Restock (Pembelian/Masuk)
                      </SelectItem>
                      <SelectItem value="production">Hasil Produksi</SelectItem>
                      <SelectItem value="damage">
                        Barang Rusak/Basi (Keluar)
                      </SelectItem>
                      <SelectItem value="void">
                        Void / Koreksi Error (Keluar)
                      </SelectItem>
                      <SelectItem value="correction">
                        Stock Opname (Sesuaikan Fisik)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* 2. QUANTITY */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchType === "correction"
                        ? "Total Fisik Saat Ini"
                        : "Jumlah (Qty)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 3. UNIT COST (Hanya Muncul saat Restock/Production) */}
              {(watchType === "restock" || watchType === "production") && (
                <FormField
                  control={form.control}
                  name="unitCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Harga Beli/Pokok (Satuan)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Opsional"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription className="text-[10px]">
                        Biarkan 0 untuk pakai harga master.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* 4. REFERENCE ID */}
            <FormField
              control={form.control}
              name="referenceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ref ID (Opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="No. PO, No. Resi, dll" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 5. NOTE (Wajib) */}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan (Wajib)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Contoh: Stok opname bulanan, Barang jatuh pecah..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isAdjusting}>
                {isAdjusting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
