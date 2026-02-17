"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Box,
  CreditCard,
  Loader2,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { AddProductDialog } from "@/components/pos/add-product-dialog";
import { CartItem } from "@/components/pos/cart-item";
import { ProductCard } from "@/components/pos/product-card";
import { useInventory } from "@/hooks/use-inventory";
import { usePOS } from "@/hooks/use-pos";
import { cn, formatRupiah } from "@/lib/utils";

export default function POSPage() {
  const {
    products,
    isLoadingProducts,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    subtotal,
    taxAmount,
    grandTotal,
    processCheckout,
    isCheckingOut,
    currentUser,
    totalItems,
  } = usePOS();

  const { isDialogOpen, setIsDialogOpen } = useInventory();
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCheckout = async () => {
    try {
      await processCheckout({
        paymentMethod: "cash",
        amountPaid: grandTotal,
      });
      setIsMobileCartOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-full w-full gap-6 font-sans select-none relative">
      <AddProductDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />

      {/* 🟢 MAIN CATALOG AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Catalog Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-foreground tracking-tighter uppercase italic">
              Point of Sale
            </h1>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
              {currentUser?.name || "System Online"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group flex-1 sm:w-64">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
                size={16}
              />
              <input
                type="text"
                placeholder="Cari menu atau SKU..."
                className="w-full h-11 rounded-2xl bg-card border border-border pl-11 pr-4 text-xs font-bold text-foreground outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 transition-all placeholder:text-muted-foreground"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center h-11 gap-2 rounded-2xl bg-primary px-6 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-lg"
            >
              <Plus size={18} strokeWidth={3} />
              <span className="hidden sm:inline">Produk Baru</span>
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          {["Semua Produk", "Makanan", "Minuman", "Snack"].map((cat, idx) => (
            <button
              key={cat}
              type="button"
              className={cn(
                "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                idx === 0
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                  : "bg-card text-muted-foreground hover:bg-muted border-border",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoadingProducts ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-6">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-muted border-t-primary animate-spin" />
                <Box
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/50"
                  size={24}
                />
              </div>
              <p className="text-[10px] font-black tracking-[0.3em] uppercase opacity-50">
                Memuat produk...
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Box size={64} strokeWidth={1} className="mb-4 opacity-20" />
              <h3 className="text-sm font-bold">Produk tidak ditemukan</h3>
              <p className="text-xs mt-1 opacity-60">Coba kata kunci lain</p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-4 text-primary text-xs font-black hover:underline underline-offset-4"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20"
            >
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => addToCart(product)}
                />
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* 🔵 SHOPPING CART SIDEBAR */}
      <AnimatePresence>
        {(isMobileCartOpen ||
          (typeof window !== "undefined" && window.innerWidth >= 1280)) && (
          <motion.div
            initial={
              typeof window !== "undefined" && window.innerWidth < 1280
                ? { x: "100%" }
                : { opacity: 0, x: 20 }
            }
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%" }}
            className={cn(
              "fixed inset-y-0 right-0 z-50 xl:relative xl:z-0 w-full max-w-[400px] flex flex-col bg-card border border-border shadow-2xl xl:shadow-none rounded-3xl overflow-hidden h-[calc(100vh-120px)] xl:h-full",
              !isMobileCartOpen && "hidden xl:flex",
            )}
          >
            {/* Cart Header */}
            <div className="flex h-16 items-center justify-between px-6 bg-card border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary text-primary-foreground rounded-xl">
                  <ShoppingCart size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="font-black text-foreground tracking-tighter uppercase text-xs">
                    KERANJANG
                  </h2>
                  <p className="text-[9px] text-muted-foreground font-bold">
                    {totalItems} item
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="xl:hidden h-8 w-8 flex items-center justify-center bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center px-6">
                  <div className="mb-6 h-20 w-20 rounded-3xl bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground/30">
                    <ShoppingCart size={32} />
                  </div>
                  <h4 className="text-foreground font-black text-[10px] uppercase tracking-[0.2em]">
                    KERANJANG KOSONG
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Klik produk untuk menambahkan
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <motion.div
                      key={item.product.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <CartItem
                        item={item}
                        onIncrement={() => addToCart(item.product)}
                        onDecrement={() => removeFromCart(item.product.id)}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary & Checkout */}
            <div className="bg-card p-6 border-t border-border shrink-0">
              <div className="space-y-3 mb-6 text-[10px] font-black uppercase tracking-widest">
                <div className="flex justify-between text-muted-foreground">
                  <span>SUBTOTAL</span>
                  <span className="font-mono text-foreground text-xs">
                    {formatRupiah(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>PPN (11%)</span>
                  <span className="font-mono text-foreground text-xs">
                    {formatRupiah(taxAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-4 mt-2 border-t border-border">
                  <span className="text-foreground font-black text-xs tracking-widest">
                    TOTAL
                  </span>
                  <span className="text-2xl text-primary font-mono font-black tracking-tighter">
                    {formatRupiah(grandTotal)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || isCheckingOut}
                  className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-primary font-black tracking-widest uppercase text-[10px] text-primary-foreground shadow-lg transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                >
                  {isCheckingOut ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      <CreditCard size={18} />
                      BAYAR — {formatRupiah(grandTotal)}
                    </>
                  )}
                </button>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    disabled={isCheckingOut}
                    className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-[10px] font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 size={14} />
                    Kosongkan
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Mobile Cart Toggle */}
      <button
        type="button"
        onClick={() => setIsMobileCartOpen(true)}
        className="xl:hidden fixed bottom-6 right-6 h-14 w-14 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-all"
      >
        <ShoppingCart size={24} />
        {totalItems > 0 && (
          <span className="absolute -top-1 -right-1 h-6 w-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-[10px] font-black font-mono">
            {totalItems}
          </span>
        )}
      </button>
    </div>
  );
}
