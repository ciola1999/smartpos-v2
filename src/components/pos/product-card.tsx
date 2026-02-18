import { AlertCircle, Package, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type * as schema from "@/db/schema";
import { formatRupiah } from "@/lib/utils/currency";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Menggabungkan tipe Produk dengan Array Varian (Relation)
type ProductWithVariants = typeof schema.products.$inferSelect & {
  variants: (typeof schema.productVariants.$inferSelect)[];
};

interface ProductCardProps {
  product: ProductWithVariants;
  onAddToCart: (p: ProductWithVariants, variantId?: string) => void;
}

// ============================================================================
// HELPER LOGIC (SAFE PARSING)
// ============================================================================

/**
 * Mengubah JSON attributes menjadi string label yang user-friendly.
 * Contoh DB: '{"Warna": "Merah", "Ukuran": "L"}' -> Output: "Merah / L"
 * Jika gagal parse/kosong, fallback ke SKU.
 */
function getVariantLabel(
  variant: typeof schema.productVariants.$inferSelect,
): string {
  if (!variant.attributes) return variant.sku; // Fallback ke SKU jika tidak ada atribut

  try {
    const attrs = JSON.parse(variant.attributes);
    // Mengambil values dari object JSON dan menggabungkannya
    const label = Object.values(attrs).join(" / ");
    return label || variant.sku;
  } catch (_e) {
    return variant.sku; // Fallback jika JSON invalid
  }
}

// ============================================================================
// COMPONENT IMPLEMENTATION
// ============================================================================

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [isVariantOpen, setIsVariantOpen] = useState(false);
  const hasVariants = product.variants.length > 0;

  // Base Price (Parse dari string ke float karena SQLite menyimpan Decimal sebagai Text)
  const basePrice = parseFloat(product.price || "0");

  // Handler Klik Utama
  const handleMainClick = () => {
    // Jika tidak ada stok dan trackInventory aktif -> Jangan lakukan apa-apa (opsional: toast)
    // Tapi di UI list, sebaiknya tombolnya disabled.

    if (hasVariants) {
      setIsVariantOpen(true);
    } else {
      onAddToCart(product);
    }
  };

  // Handler Pilih Varian
  const handleVariantSelect = (variantId: string) => {
    onAddToCart(product, variantId);
    setIsVariantOpen(false);
  };

  // Cek Stok Utama (Simple Product)
  // Note: Schema 'products' tidak punya kolom stock, asumsi unlimited atau validasi BE.
  // Jika nanti ada kolom stock di products, tambahkan: const isOutOfStock = product.trackInventory && product.stock <= 0;
  const isOutOfStock = false;

  return (
    <>
      <Card
        className={`flex flex-col justify-between overflow-hidden transition-all h-full
          ${isOutOfStock ? "opacity-60 grayscale cursor-not-allowed" : "cursor-pointer hover:border-primary active:scale-95"}
        `}
        onClick={!isOutOfStock ? handleMainClick : undefined}
      >
        <CardContent className="p-4 pt-6 flex-1">
          {/* Header: Icon & Badge */}
          <div className="flex justify-between items-start mb-3">
            <div className="h-10 w-10 bg-muted/50 rounded-lg flex items-center justify-center text-muted-foreground">
              <Package size={20} />
            </div>
            {hasVariants && (
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                {product.variants.length} Opsi
              </Badge>
            )}
          </div>

          {/* Product Info */}
          <h3
            className="font-semibold text-sm line-clamp-2 leading-snug mb-1"
            title={product.name}
          >
            {product.name}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            {product.sku}
          </p>
        </CardContent>

        {/* Footer: Price & Action */}
        <CardFooter className="p-4 pt-0 flex justify-between items-center bg-muted/10 border-t mt-auto min-h-[50px]">
          <div className="font-bold text-primary text-sm">
            {formatRupiah(basePrice)}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full hover:bg-primary hover:text-primary-foreground"
            disabled={isOutOfStock}
          >
            {isOutOfStock ? <AlertCircle size={16} /> : <Plus size={16} />}
          </Button>
        </CardFooter>
      </Card>

      {/* ======================= */}
      {/* DIALOG PILIH VARIAN     */}
      {/* ======================= */}
      <Dialog open={isVariantOpen} onOpenChange={setIsVariantOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
            <DialogDescription>Pilih varian yang tersedia</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 mt-2 max-h-[60vh] overflow-y-auto pr-1">
            {product.variants.map((variant) => {
              // Logic Stok Varian
              const variantStock = variant.stock ?? 0;
              const isVariantEmpty =
                product.trackInventory && variantStock <= 0;
              const variantPrice =
                basePrice + parseFloat(variant.priceAdjustment || "0");
              const label = getVariantLabel(variant);

              return (
                <Button
                  key={variant.id}
                  variant="outline"
                  className={`justify-between h-auto py-3 px-4 ${
                    isVariantEmpty
                      ? "opacity-50 cursor-not-allowed bg-muted"
                      : "hover:border-primary"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isVariantEmpty) handleVariantSelect(variant.id);
                  }}
                  disabled={isVariantEmpty}
                >
                  <div className="flex flex-col items-start gap-0.5 text-left">
                    <span className="font-medium text-sm">{label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      SKU: {variant.sku} • Stok:{" "}
                      {product.trackInventory ? variantStock : "∞"}
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-sm">
                      {formatRupiah(variantPrice)}
                    </div>
                    {isVariantEmpty && (
                      <span className="text-[10px] text-red-500 font-medium">
                        Habis
                      </span>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
