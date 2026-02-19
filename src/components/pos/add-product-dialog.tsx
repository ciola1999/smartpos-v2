import { ChevronDown, Loader2, Package, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import type * as schema from "@/db/schema";
import { useProductMutations } from "@/hooks/use-products";
import { useSessionStore } from "@/hooks/use-session-store";
import {
  ProductFormSchema,
  type ProductFormValues,
} from "@/lib/validations/product";
import { ProductService } from "@/services/product.service";

interface AddProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddProductDialog({ isOpen, onClose }: AddProductDialogProps) {
  const { branchId, warehouseId, userId } = useSessionStore();
  const { createProduct } = useProductMutations(branchId || "");

  // Local state untuk error handling manual (tanpa react-hook-form agar ringan dulu)
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<
    (typeof schema.categories.$inferSelect)[]
  >([]);

  const [formData, setFormData] = useState<ProductFormValues>({
    name: "",
    price: 0,
    costPrice: 0,
    stock: 0,
    sku: "",
    barcode: "",
    categoryId: "",
    unit: "pcs",
    valuationMethod: "fifo",
    minStock: 0,
    maxStock: null,
    weight: null,
    weightUnit: "kg",
    dimensions: null,
    description: "",
    images: [],
    productType: "simple",
    trackInventory: true,
    hasRecipe: false,
    status: "active",
    attributes: {},
  });

  // Fetch Categories on Mount
  useEffect(() => {
    if (isOpen && branchId) {
      ProductService.getCategories(branchId).then((res) => {
        if (res.success && res.data) {
          setCategories(res.data as (typeof schema.categories.$inferSelect)[]);
        }
      });
    }
  }, [isOpen, branchId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🛡️ Zod Validation
    const result = ProductFormSchema.safeParse(formData);

    if (!result.success) {
      // Mapping Zod errors ke UI
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[String(issue.path[0])] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Jika valid, kirim ke logic mutation
    try {
      await createProduct.mutateAsync({
        warehouseId: warehouseId || "default-wh",
        data: result.data,
        userId: userId || "system",
      });

      // Reset form setelah sukses
      setFormData({
        name: "",
        price: 0,
        costPrice: 0,
        stock: 0,
        sku: "",
        barcode: "",
        categoryId: "",
        unit: "pcs",
        valuationMethod: "fifo",
        minStock: 0,
        maxStock: null,
        weight: null,
        weightUnit: "kg",
        dimensions: null,
        description: "",
        images: [],
        productType: "simple",
        trackInventory: true,
        hasRecipe: false,
        status: "active",
        attributes: {},
      });
      setErrors({});
      onClose(); // Tutup setelah sukses
    } catch (_err) {
      // Error di-handle oleh toast di mutation.onError
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all dark">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Package size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100 text-lg leading-tight">
                Produk Baru
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Isi detail inventaris toko
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          {/* Scrollable Form Content */}
          <div className="overflow-y-auto p-6 flex-1">
            <div className="space-y-5">
              {/* Nama Produk */}
              <div className="space-y-1.5">
                <label
                  htmlFor="name"
                  className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Nama Produk <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Contoh: Kopi Susu Gula Aren"
                  className={`w-full rounded-xl border px-4 py-2.5 outline-none transition-all dark:bg-slate-800 dark:text-gray-100 ${
                    errors.name
                      ? "border-red-500 focus:ring-red-200 dark:focus:ring-red-900/30"
                      : "border-gray-200 dark:border-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20"
                  }`}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
                {errors.name && (
                  <p className="text-xs text-red-500 font-medium">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Kategori & Barcode */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="categoryId"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Kategori
                  </label>
                  <div className="relative">
                    <select
                      id="categoryId"
                      className="w-full appearance-none rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 pr-10 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 transition-all text-sm dark:text-gray-100"
                      value={formData.categoryId || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, categoryId: e.target.value })
                      }
                    >
                      <option value="">Pilih Kategori</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
                      size={16}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="barcode"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Barcode (Scan)
                  </label>
                  <input
                    id="barcode"
                    type="text"
                    placeholder="Scan barcode produk..."
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 transition-all font-mono text-sm dark:text-gray-100"
                    value={formData.barcode || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, barcode: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {/* Harga Jual */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="price"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Harga Jual <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm font-medium">
                      Rp
                    </span>
                    <input
                      id="price"
                      type="number"
                      min="0"
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-4 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 transition-all font-mono text-gray-800 dark:text-gray-100"
                      value={formData.price || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                {/* Harga Modal (Cost) */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="costPrice"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Harga Modal (HPP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm font-medium">
                      Rp
                    </span>
                    <input
                      id="costPrice"
                      type="number"
                      min="0"
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-4 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 transition-all font-mono text-gray-500 dark:text-gray-400"
                      value={formData.costPrice || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          costPrice: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5">
                {/* Satuan */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="unit"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Satuan
                  </label>
                  <input
                    id="unit"
                    type="text"
                    placeholder="pcs, gr, porsi"
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 transition-all text-sm dark:text-gray-100"
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
                  />
                </div>

                {/* Stok */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="stock"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Stok Awal <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="stock"
                    type="number"
                    min="0"
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 transition-all font-mono dark:text-gray-100"
                    value={formData.stock || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stock: Number(e.target.value),
                      })
                    }
                  />
                </div>

                {/* Min Stok */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="minStock"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Min. Stok
                  </label>
                  <input
                    id="minStock"
                    type="number"
                    min="0"
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 transition-all font-mono dark:text-gray-100"
                    value={formData.minStock || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minStock: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              {/* SKU & Image URL */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="sku"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    SKU (Internal)
                  </label>
                  <input
                    id="sku"
                    type="text"
                    placeholder="Auto-generate jika kosong"
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 transition-all font-mono text-sm dark:text-gray-100"
                    value={formData.sku || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="images"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    URL Gambar
                  </label>
                  <input
                    id="images"
                    type="text"
                    placeholder="https://..."
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 transition-all text-sm dark:text-gray-100"
                    value={formData.images[0] || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        images: e.target.value ? [e.target.value] : [],
                      })
                    }
                  />
                </div>
              </div>

              {/* Deskripsi */}
              <div className="space-y-1.5">
                <label
                  htmlFor="description"
                  className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Deskripsi Produk
                </label>
                <textarea
                  id="description"
                  rows={2}
                  placeholder="Tambahkan catatan singkat..."
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20 transition-all text-sm resize-none dark:text-gray-100"
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-slate-600 rounded-xl transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createProduct.isPending}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {createProduct.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Simpan Produk
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
