import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { and, eq, isNull } from "drizzle-orm";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { v7 as uuidv7 } from "uuid";

import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import { createOrderSchema } from "@/lib/validations/order";
import {
  type CreateOrderPayload,
  OrderService,
} from "@/services/order.service";

// ============================================================================
// 1. TYPE DEFINITIONS
// ============================================================================

// Tipe Data Product lengkap dengan Varian (Join Result)
type ProductWithVariants = typeof schema.products.$inferSelect & {
  variants: (typeof schema.productVariants.$inferSelect)[];
};

// Item dalam Keranjang (Frontend State)
export type CartItem = {
  rowId: string; // ID Unik untuk Key React (UUID v7)
  productId: string;
  variantId?: string | null;
  batchId?: string | null;

  // Snapshot Data untuk Tampilan UI
  name: string;
  sku: string;
  price: number; // Harga Jual Satuan (Base + Variant Adj)
  costPrice: number; // HPP (untuk estimasi margin di UI jika perlu)

  // Mutable User Input
  quantity: number;
  discount: number; // Nominal Diskon per item (sesuai schema orderItems)
  note?: string; // Catatan per item (sesuai schema orderItems)

  // Validation Helpers
  maxStock: number; // Batas stok saat ini
  trackInventory: boolean;
};

// Ringkasan Kalkulasi Keuangan
export type CartSummary = {
  subtotal: number; // Total Harga Barang (Qty * Price)
  totalDiscount: number; // Total Diskon Item
  taxAmount: number; // Pajak (PPN)
  grandTotal: number; // Yang harus dibayar
  totalItems: number; // Jumlah pcs barang
};

// Parameter Checkout
export type CheckoutParams = {
  paymentMethod: "cash" | "debit" | "credit" | "qris" | "transfer" | "split";
  amountPaid: number;
  orderType: "dine_in" | "take_away" | "delivery";
  tableNumber?: string; // Opsional sesuai schema
  note?: string; // Catatan global order
};

// ============================================================================
// 2. HOOK IMPLEMENTATION
// ============================================================================

export function usePOS(
  branchId: string,
  warehouseId: string,
  cashierId: string,
) {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [transactionStatus, setTransactionStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");

  // --------------------------------------------------------------------------
  // A. DATA FETCHING (Local-First / Eager Load)
  // --------------------------------------------------------------------------

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["pos-products", branchId],
    queryFn: async () => {
      // Fetch Produk & Varian.
      // Note: Di sistem besar, filter by branchId jika produk berbeda tiap cabang.
      return await getDb().query.products.findMany({
        where: and(
          eq(schema.products.isActive, true),
          isNull(schema.products.deletedAt),
        ),
        with: {
          variants: true, // Eager load varian untuk seleksi cepat
        },
      });
    },
  });

  // --------------------------------------------------------------------------
  // B. CART ACTIONS (Logic Powerful & Type-Safe)
  // --------------------------------------------------------------------------

  /**
   * 1. Add Item: Menangani Product Simple & Variant
   * Logika: Cek apakah item (Product + Variant + Batch) sudah ada di cart?
   * Jika ya -> Tambah Qty. Jika tidak -> Buat Baris Baru.
   */
  const addToCart = useCallback(
    (
      product: ProductWithVariants,
      variantId?: string | null,
      batchId?: string | null,
    ) => {
      setCart((prev) => {
        // Setup Initial Values
        let targetPrice = parseFloat(product.price || "0");
        let targetName = product.name;
        let targetSku = product.sku;
        let maxStock = 999999; // Default unlimited

        // Handle Variant Logic
        if (variantId) {
          const variant = product.variants.find((v) => v.id === variantId);
          if (!variant) {
            toast.error("Varian data mismatch!");
            return prev;
          }

          targetName = `${product.name} - ${variant.sku}`; // UI Friendly Name
          targetSku = variant.sku;
          targetPrice += parseFloat(variant.priceAdjustment || "0"); // Adjust Price

          if (product.trackInventory && variant.stock !== null) {
            maxStock = variant.stock;
          }
        }
        // Handle Simple Product Logic (jika tanpa varian)
        else {
          // Karena schema 'products' tidak punya kolom stock, kita asumsikan
          // validasi stok simple product dilakukan via Batch atau dilepas (unlimited)
          // kecuali ada query stockMovements terpisah.
        }

        // Cek Duplikasi di Cart (Matching Product + Variant + Batch)
        const existingIdx = prev.findIndex(
          (item) =>
            item.productId === product.id &&
            item.variantId === variantId &&
            item.batchId === batchId,
        );

        // Logic Update atau Insert
        if (existingIdx >= 0) {
          const existingItem = prev[existingIdx];
          if (product.trackInventory && existingItem.quantity + 1 > maxStock) {
            toast.warning(`Stok terbatas! Sisa: ${maxStock}`);
            return prev;
          }

          const newCart = [...prev];
          newCart[existingIdx] = {
            ...existingItem,
            quantity: existingItem.quantity + 1,
          };
          return newCart;
        } else {
          if (product.trackInventory && maxStock < 1) {
            toast.warning("Stok habis!");
            return prev;
          }

          return [
            ...prev,
            {
              rowId: uuidv7(),
              productId: product.id,
              variantId: variantId || null,
              batchId: batchId || null,
              name: targetName,
              sku: targetSku,
              price: targetPrice,
              costPrice: parseFloat(product.costPrice || "0"),
              quantity: 1,
              discount: 0,
              note: "",
              maxStock,
              trackInventory: product.trackInventory ?? true,
            },
          ];
        }
      });
    },
    [],
  );

  /**
   * 2. Update Quantity
   * Menjaga agar tidak minus dan tidak melebihi stok.
   */
  const updateQuantity = useCallback((rowId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.rowId !== rowId) return item;

          const newQty = item.quantity + delta;

          // Validasi Stok (Client Side)
          if (item.trackInventory && delta > 0 && newQty > item.maxStock) {
            toast.warning(`Mencapai batas stok (${item.maxStock})`);
            return item;
          }

          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0); // Auto remove jika 0
    });
  }, []);

  /**
   * 3. Update Item Details (Diskon & Note) - NEW FEATURE
   * Penting untuk memanfaatkan kolom 'discount' dan 'note' di schema orderItems
   */
  const updateItem = useCallback(
    (rowId: string, updates: Partial<Pick<CartItem, "discount" | "note">>) => {
      setCart((prev) =>
        prev.map((item) => {
          if (item.rowId !== rowId) return item;
          return { ...item, ...updates };
        }),
      );
    },
    [],
  );

  /**
   * 4. Remove Item Explicitly
   */
  const removeItem = useCallback((rowId: string) => {
    setCart((prev) => prev.filter((item) => item.rowId !== rowId));
  }, []);

  /**
   * 5. Clear Cart
   */
  const clearCart = useCallback(() => {
    setCart([]);
    setTransactionStatus("idle");
  }, []);

  // --------------------------------------------------------------------------
  // C. CALCULATIONS (Memoized for Performance)
  // --------------------------------------------------------------------------

  const summary: CartSummary = useMemo(() => {
    const subtotal = cart.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );
    const totalDiscount = cart.reduce((acc, item) => acc + item.discount, 0); // Total diskon nominal

    // Pajak (Placeholder Logic: Bisa ambil dari StoreSetting nanti)
    const taxRate = 0;
    // Tax biasanya dikenakan setelah diskon: (Subtotal - Diskon) * Rate
    const taxableAmount = Math.max(0, subtotal - totalDiscount);
    const taxAmount = taxableAmount * taxRate;

    const grandTotal = Math.max(0, taxableAmount + taxAmount);
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

    return { subtotal, totalDiscount, taxAmount, grandTotal, totalItems };
  }, [cart]);

  // --------------------------------------------------------------------------
  // D. CHECKOUT PROCESS (Transaction)
  // --------------------------------------------------------------------------

  const checkoutMutation = useMutation({
    mutationFn: async (params: CheckoutParams) => {
      // 1. Validasi Awal State
      if (cart.length === 0) throw new Error("Keranjang kosong!");
      if (!branchId || !warehouseId || !cashierId)
        throw new Error("Sesi kasir tidak valid (Missing ID).");

      // 2. Mapping ke Payload Service (Type-Safe)
      const payload: CreateOrderPayload = {
        branchId,
        warehouseId,
        cashierId,
        memberId: null, // Bisa dikembangkan untuk member

        type: params.orderType,
        tableNumber: params.tableNumber,
        note: params.note,

        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          batchId: item.batchId,
          quantity: item.quantity,
          discount: item.discount, // Mengirim nominal diskon per item
          note: item.note, // Mengirim catatan per item
        })),

        payments: [
          {
            method: params.paymentMethod,
            amount: params.amountPaid,
            referenceId: undefined, // Bisa diisi jika ada No Ref EDC
          },
        ],
      };

      // 3. Validasi Zod (Safety Net sebelum kirim ke DB)
      //    Ini akan menangkap error jika format data salah
      const validation = createOrderSchema.safeParse(payload);
      if (!validation.success) {
        const errorMsg = validation.error.issues
          .map((i) => i.message)
          .join(", ");
        throw new Error(`Validasi Data Gagal: ${errorMsg}`);
      }

      // 4. Eksekusi Service
      return await OrderService.createTransaction(payload);
    },

    onMutate: () => setTransactionStatus("processing"),

    onSuccess: (data) => {
      setTransactionStatus("success");
      toast.success(`Transaksi Berhasil!`, {
        description: `Order #${data.orderNumber} disimpan.`,
      });
      clearCart();

      // Invalidate query agar stok produk ter-update di list
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });

      // TODO: Trigger Print Struk via Tauri Command di sini
    },

    onError: (error: Error) => {
      setTransactionStatus("error");
      toast.error("Transaksi Gagal", {
        description: error.message,
      });
      console.error("POS Error:", error);
    },
  });

  return {
    // Data State
    products,
    isLoadingProducts,
    cart,
    summary,
    transactionStatus,

    // Actions
    addToCart,
    updateQuantity,
    updateItem, // NEW: Untuk edit diskon/note
    removeItem,
    clearCart,

    // Checkout
    processCheckout: checkoutMutation.mutate,
    isProcessing: checkoutMutation.isPending,
  };
}
