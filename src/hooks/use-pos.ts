import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { and, eq, isNull } from "drizzle-orm";
import { useState } from "react";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";

// --- TYPES ---
export type CartItem = {
  product: schema.Product;
  quantity: number;
  note?: string;
};

export type POSTransactionStatus = "idle" | "processing" | "success" | "error";

// --- HOOK ---
export function usePOS() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [selectedTaxRate, setSelectedTaxRate] = useState<number>(11); // PPN 11% default
  const [transactionStatus, setTransactionStatus] =
    useState<POSTransactionStatus>("idle");

  // 1. FETCH PRODUCTS & CURRENT USER
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const db = getDb();
      return await db
        .select()
        .from(schema.products)
        .where(
          and(
            eq(schema.products.isActive, true),
            isNull(schema.products.deletedAt),
          ),
        );
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const db = getDb();
      const result = await db.select().from(schema.users).limit(1);
      return result[0] || null;
    },
  });

  // 2. CALCULATIONS (React Compiler handles memoization automatically)
  const subtotal = cart.reduce((acc, item) => {
    const price = Number(item.product.price);
    return acc + price * item.quantity;
  }, 0);

  const discountAmount = (subtotal * globalDiscount) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = (taxableAmount * selectedTaxRate) / 100;
  const grandTotal = Math.max(0, Math.round(taxableAmount + taxAmount));
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  // 3. ACTIONS
  const addToCart = (product: schema.Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      const currentQty = existing ? existing.quantity : 0;

      if (currentQty + 1 > product.stock) return prev;

      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string, removeAll = false) => {
    setCart((prev) => {
      if (removeAll)
        return prev.filter((item) => item.product.id !== productId);
      return prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0);
    });
  };

  const clearCart = () => {
    setCart([]);
    setGlobalDiscount(0);
    setTransactionStatus("idle");
  };

  // 4. CHECKOUT PROCESS
  const checkoutMutation = useMutation({
    mutationFn: async (params: {
      paymentMethod: "cash" | "qris" | "debit" | "split";
      amountPaid: number;
    }) => {
      if (cart.length === 0) throw new Error("Keranjang kosong");
      if (!currentUser) throw new Error("Sesi kasir tidak valid");

      const { OrderService } = await import("@/services/order.service");

      const payload = {
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: Number(item.product.price),
        })),
        paymentMethod: params.paymentMethod,
        amountPaid: params.amountPaid.toString(),
        orderType: "dine_in" as const,
        memberId: null,
        discountId: null,
      };

      return await OrderService.createTransaction(payload, currentUser.id);
    },
    onMutate: () => setTransactionStatus("processing"),
    onSuccess: () => {
      setTransactionStatus("success");
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      setTransactionStatus("error");
      console.error("Checkout Failed:", error);
    },
  });

  return {
    products,
    isLoadingProducts,
    cart,
    subtotal,
    taxAmount,
    discountAmount,
    grandTotal,
    totalItems,
    setGlobalDiscount,
    setSelectedTaxRate,
    addToCart,
    removeFromCart,
    clearCart,
    processCheckout: checkoutMutation.mutateAsync,
    isCheckingOut: checkoutMutation.isPending,
    transactionStatus,
    currentUser,
  };
}
