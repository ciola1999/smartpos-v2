import { Loader2, Package, Save, X } from "lucide-react";
import { useState } from "react";
import { useInventory } from "@/hooks/use-inventory";
import {
  ProductFormSchema,
  type ProductFormValues,
} from "@/lib/validations/product";

interface AddProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddProductDialog({ isOpen, onClose }: AddProductDialogProps) {
  const { createProduct, isCreating } = useInventory();

  // Local state untuk error handling manual (tanpa react-hook-form agar ringan dulu)
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<ProductFormValues>({
    name: "",
    price: 0,
    costPrice: 0,
    stock: 0,
    sku: "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🛡️ Zod Validation
    const result = ProductFormSchema.safeParse(formData);

    if (!result.success) {
      // Mapping Zod errors ke UI
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        // 🛠️ FIX: Konversi path ke String secara eksplisit
        // Ini menangani error TS2538 dan memastikan key selalu valid
        if (issue.path[0]) {
          fieldErrors[String(issue.path[0])] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Jika valid, kirim ke logic hook
    await createProduct(result.data);

    // Reset form setelah sukses
    setFormData({ name: "", price: 0, costPrice: 0, stock: 0, sku: "" });
    setErrors({});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2.5 text-blue-600">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-tight">
                Produk Baru
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Isi detail inventaris toko
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="overflow-y-auto p-6">
          <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Nama Produk */}
            <div className="space-y-1.5">
              <label
                htmlFor="name"
                className="text-sm font-semibold text-gray-700"
              >
                Nama Produk <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Kopi Susu Gula Aren"
                className={`w-full rounded-xl border px-4 py-2.5 outline-none transition-all ${
                  errors.name
                    ? "border-red-500 focus:ring-red-200"
                    : "border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
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

            <div className="grid grid-cols-2 gap-5">
              {/* Harga Jual */}
              <div className="space-y-1.5">
                <label
                  htmlFor="price"
                  className="text-sm font-semibold text-gray-700"
                >
                  Harga Jual (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-gray-800"
                  value={formData.price || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, price: Number(e.target.value) })
                  }
                />
              </div>

              {/* Harga Modal (Cost) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="costPrice"
                  className="text-sm font-semibold text-gray-700"
                >
                  Harga Modal (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-gray-500"
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

            <div className="grid grid-cols-2 gap-5">
              {/* Stok */}
              <div className="space-y-1.5">
                <label
                  htmlFor="stock"
                  className="text-sm font-semibold text-gray-700"
                >
                  Stok Awal <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono"
                  value={formData.stock || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: Number(e.target.value) })
                  }
                />
              </div>

              {/* SKU */}
              <div className="space-y-1.5">
                <label
                  htmlFor="sku"
                  className="text-sm font-semibold text-gray-700"
                >
                  SKU / Barcode
                </label>
                <input
                  type="text"
                  placeholder="Auto-generate jika kosong"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-sm"
                  value={formData.sku || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 rounded-xl transition-all"
          >
            Batal
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={isCreating}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
          >
            {isCreating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Simpan Produk
          </button>
        </div>
      </div>
    </div>
  );
}
