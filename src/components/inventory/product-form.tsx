"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { type Resolver, useForm } from "react-hook-form"; // Import Resolver type
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
// 🎣 Hooks & Types
import { useProductMutations } from "@/hooks/use-products";
import { useSessionStore } from "@/hooks/use-session-store";
// 📦 Validasi Zod
import {
  ProductFormSchema,
  type ProductFormValues,
} from "@/lib/validations/product";
import type { ProductSelect } from "@/services/product.service";

// ─────────────────────────────────────────────────────────────────────────────
// 🛡️ TYPE DEFINITIONS (Bridge between DB & UI)
// ─────────────────────────────────────────────────────────────────────────────

// Definisi Strict untuk Data yang keluar dari Database (Sesuai Schema Realita)
// Ini menghindari penggunaan 'as any' saat mapping
interface DatabaseProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  price: string; // SQLite Decimal -> String
  costPrice: string; // SQLite Decimal -> String

  // Kolom yang namanya beda / tipe beda
  minimumStock: number | null; // DB: minimumStock
  unit: string | null;

  categoryId: string | null;
  taxId: string | null;

  isActive: boolean; // DB: isActive
  trackInventory: boolean | null;
  hasRecipe: boolean | null;
  type: string; // DB: type ('simple' | 'variable')

  imageUrls: string | null; // DB: String JSON
}

interface ProductFormProps {
  branchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Kita terima ProductSelect tapi akan kita treat sebagai DatabaseProduct saat mapping
  initialData?: ProductSelect | null;
  categories: { id: string; name: string }[];
}

export function ProductForm({
  branchId,
  open,
  onOpenChange,
  initialData,
  categories,
}: ProductFormProps) {
  const { warehouseId, userId } = useSessionStore();
  const { createProduct, updateProduct } = useProductMutations(branchId);
  const isEdit = !!initialData;
  const isLoading = createProduct.isPending || updateProduct.isPending;

  // 1. Setup Form dengan Resolver Casting yang Type-Safe
  // ⚠️ FIX CRITICAL: 'as Resolver<ProductFormValues>' memberitahu useForm
  // bahwa resolver ini PASTI menghasilkan tipe data yang benar, memutus siklus error inferensi.
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(ProductFormSchema) as Resolver<ProductFormValues>,
    defaultValues: {
      name: "",
      sku: "",
      barcode: null,
      description: "",
      price: 0,
      costPrice: 0,
      stock: 0,
      minStock: 0,
      unit: "pcs",
      categoryId: null,
      taxId: null,
      status: "active",
      trackInventory: true,
      hasRecipe: false,
      productType: "simple",
      images: [],
      attributes: {},
    },
  });

  // 2. Mapping Data (DB -> Form)
  useEffect(() => {
    if (open) {
      if (initialData) {
        // --- MODE EDIT ---

        // 🛡️ Type Assertion ke Interface Lokal yang mencerminkan Schema Asli
        // Ini aman karena kita tahu struktur tabel sebenarnya
        const dbProduct = initialData as unknown as DatabaseProduct;

        // Parsing Safe
        const parsedPrice = parseFloat(dbProduct.price);
        const parsedCost = parseFloat(dbProduct.costPrice);

        let parsedImages: string[] = [];
        try {
          parsedImages = dbProduct.imageUrls
            ? JSON.parse(dbProduct.imageUrls)
            : [];
        } catch {
          parsedImages = [];
        }

        form.reset({
          name: dbProduct.name,
          sku: dbProduct.sku,
          barcode: dbProduct.barcode,
          description: dbProduct.description || "",

          // 💰 Number Conversion
          price: Number.isNaN(parsedPrice) ? 0 : parsedPrice,
          costPrice: Number.isNaN(parsedCost) ? 0 : parsedCost,

          // 📦 Column Name Mapping
          minStock: dbProduct.minimumStock ?? 0,
          stock: 0, // Stok di-disable saat edit
          unit: dbProduct.unit ?? "pcs",

          categoryId: dbProduct.categoryId,
          taxId: dbProduct.taxId,

          // ⚙️ Status & Enum Mapping
          status: dbProduct.isActive ? "active" : "inactive",
          trackInventory: dbProduct.trackInventory ?? true,
          hasRecipe: dbProduct.hasRecipe ?? false,

          productType: dbProduct.type === "variable" ? "variable" : "simple",

          images: Array.isArray(parsedImages) ? parsedImages : [],
          attributes: {},
        });
      } else {
        // --- MODE CREATE ---
        form.reset({
          name: "",
          sku: `SKU-${Date.now().toString().slice(-6)}`,
          barcode: null,
          description: "",
          price: 0,
          costPrice: 0,
          stock: 0,
          minStock: 5,
          unit: "pcs",
          categoryId: null,
          taxId: null,
          status: "active",
          trackInventory: true,
          hasRecipe: false,
          productType: "simple",
          images: [],
          attributes: {},
        });
      }
    }
  }, [open, initialData, form]);

  const onSubmit = async (values: ProductFormValues) => {
    if (!warehouseId || !userId) return;

    try {
      if (isEdit && initialData) {
        await updateProduct.mutateAsync({
          productId: initialData.id,
          data: values,
          userId,
        });
      } else {
        await createProduct.mutateAsync({
          warehouseId,
          data: values,
          userId,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Produk" : "Tambah Produk Baru"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Nama Produk</FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: Kopi Susu" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="Kopi-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barcode</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Scan..."
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Kategori" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="inactive">Non-Aktif</SelectItem>
                        <SelectItem value="archived">Arsip</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* HARGA */}
            <div className="p-4 border rounded-lg bg-gray-50/50 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Harga Jual</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Harga Modal</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* INVENTORY */}
            <div className="p-4 border rounded-lg bg-gray-50/50 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Inventory</h3>
                <FormField
                  control={form.control}
                  name="trackInventory"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">
                        Lacak Stok
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("trackInventory") && (
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stok Awal</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            disabled={isEdit}
                            className={isEdit ? "bg-gray-100" : ""}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        {isEdit && (
                          <FormDescription className="text-xs">
                            Edit via Stock Opname
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min. Stok</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Satuan</FormLabel>
                        <FormControl>
                          <Input placeholder="Pcs" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi</FormLabel>
                  <FormControl>
                    <Textarea className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEdit ? "Simpan" : "Buat"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
