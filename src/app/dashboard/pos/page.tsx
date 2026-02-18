"use client";

import { Loader2, PackageOpen, Search, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartItemRow } from "@/components/pos/cart-item";
import { PaymentModal } from "@/components/pos/payment-modal";
// Components
import { ProductCard } from "@/components/pos/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { usePOS } from "@/hooks/use-pos";
import { formatRupiah } from "@/lib/utils/currency";

// ============================================================================
// MOCK SESSION (REPLACE WITH REAL AUTH CONTEXT)
// ============================================================================
// Dalam production, ini diambil dari useSession() atau Global Context
// Pastikan ID ini sesuai dengan data di tabel 'branches', 'warehouses', 'users'
const CURRENT_SESSION = {
  branchId: "branch-001",
  warehouseId: "wh-001",
  cashierId: "user-123", // ID User yang sedang login
  cashierName: "Budi Santoso",
};

export default function POSPage() {
  // 1. Hook Initialization
  const {
    products,
    isLoadingProducts,
    cart,
    summary,
    addToCart,
    updateQuantity,
    updateItem,
    removeItem,
    clearCart,
    processCheckout,
    isProcessing,
  } = usePOS(
    CURRENT_SESSION.branchId,
    CURRENT_SESSION.warehouseId,
    CURRENT_SESSION.cashierId,
  );

  // 2. Local State
  const [searchQuery, setSearchQuery] = useState("");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  // 3. Search Logic (Memoized & Powerful)
  // Mencari berdasarkan: Nama Produk, SKU, atau Barcode
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;

    const lowerQuery = searchQuery.toLowerCase().trim();

    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(lowerQuery);
      const matchSku = p.sku.toLowerCase().includes(lowerQuery);
      // Schema: barcode text | null
      const matchBarcode =
        p.barcode?.toLowerCase().includes(lowerQuery) ?? false;

      return matchName || matchSku || matchBarcode;
    });
  }, [products, searchQuery]);

  // Keyboard Shortcut: Tekan '/' untuk fokus ke search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        document.getElementById("product-search")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-[calc(100vh-1rem)] gap-4 p-4 overflow-hidden bg-background font-sans">
      {/* ================================================================== */}
      {/* LEFT PANEL: CATALOG (70-75% Width)                                 */}
      {/* ================================================================== */}
      <div className="flex flex-col flex-1 gap-0 overflow-hidden rounded-xl border bg-card shadow-sm">
        {/* Header Section */}
        <div className="p-4 border-b space-y-4 bg-background z-10">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Kasir</h1>
              <p className="text-xs text-muted-foreground">
                Shift: {CURRENT_SESSION.cashierName} •{" "}
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            {/* Indikator Total Produk */}
            <Badge variant="outline" className="h-7 px-3">
              {products.length} Item
            </Badge>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="product-search"
              placeholder="Cari produk (Nama, SKU, Barcode)... (Tekan '/')"
              className="pl-9 bg-muted/40 border-muted-foreground/20 h-10 transition-all focus:bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Product Grid Area */}
        <div className="flex-1 bg-muted/10 relative">
          <ScrollArea className="h-full p-4">
            {isLoadingProducts ? (
              // Loading State
              <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse">
                  Memuat katalog...
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              // Empty State
              <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="bg-muted p-4 rounded-full">
                  <PackageOpen size={32} />
                </div>
                <p>Produk tidak ditemukan.</p>
                <Button
                  variant="link"
                  onClick={() => setSearchQuery("")}
                  className="text-primary"
                >
                  Bersihkan Pencarian
                </Button>
              </div>
            ) : (
              // Grid Layout
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-20">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* ================================================================== */}
      {/* RIGHT PANEL: CART & CHECKOUT (Fixed Width ~400px)                  */}
      {/* ================================================================== */}
      <div className="flex flex-col w-[400px] shrink-0 rounded-xl border bg-card shadow-sm overflow-hidden h-full">
        {/* Cart Header */}
        <div className="p-4 border-b flex justify-between items-center bg-card shadow-sm z-10">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-md text-primary">
              <ShoppingCart size={18} />
            </div>
            <div>
              <h2 className="font-bold text-sm leading-none">Keranjang</h2>
              <span className="text-[10px] text-muted-foreground">
                Order #
                {Math.floor(Date.now() / 1000)
                  .toString()
                  .slice(-6)}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2 text-xs"
            onClick={clearCart}
            disabled={cart.length === 0}
          >
            Reset
          </Button>
        </div>

        {/* Cart Items List */}
        <ScrollArea className="flex-1 bg-muted/5">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground gap-3 opacity-60">
              <ShoppingCart size={64} strokeWidth={1} />
              <p className="text-sm">Belum ada item dipilih</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/50">
              {cart.map((item) => (
                <CartItemRow
                  key={item.rowId}
                  item={item}
                  onUpdateQty={updateQuantity}
                  onRemove={removeItem}
                  onUpdateDetails={updateItem}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Cart Summary & Actions (Sticky Bottom) */}
        <div className="bg-background border-t p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 space-y-4">
          {/* Summary Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({summary.totalItems} item)</span>
              <span>{formatRupiah(summary.subtotal)}</span>
            </div>

            {summary.totalDiscount > 0 && (
              <div className="flex justify-between text-red-600 font-medium animate-in slide-in-from-right-2">
                <span>Total Hemat</span>
                <span>-{formatRupiah(summary.totalDiscount)}</span>
              </div>
            )}

            {/* Placeholder Tax (Logic pajak bisa diimplementasikan di service nanti) */}
            <div className="flex justify-between text-muted-foreground">
              <span>Pajak (0%)</span>
              <span>{formatRupiah(summary.taxAmount)}</span>
            </div>

            <Separator className="my-2" />

            <div className="flex justify-between items-end">
              <span className="font-bold text-lg">Total</span>
              <span className="font-extrabold text-2xl text-primary">
                {formatRupiah(summary.grandTotal)}
              </span>
            </div>
          </div>

          {/* Action Button */}
          <Button
            size="lg"
            className="w-full font-bold text-md h-12 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
            disabled={cart.length === 0 || isProcessing}
            onClick={() => setIsPaymentOpen(true)}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Memproses Transaksi...
              </>
            ) : (
              <div className="flex justify-between w-full items-center">
                <span>Bayar Sekarang</span>
                <span className="bg-primary-foreground/20 px-2 py-0.5 rounded text-sm">
                  CTRL+ENTER
                </span>
              </div>
            )}
          </Button>
        </div>
      </div>

      {/* Payment Modal Overlay */}
      <PaymentModal
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        totalAmount={summary.grandTotal}
        onConfirm={processCheckout}
        isProcessing={isProcessing}
      />
    </div>
  );
}
