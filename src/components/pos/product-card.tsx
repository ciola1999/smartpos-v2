import { PackageOpen, Plus } from "lucide-react";
import type { Product } from "@/db/schema";
import { cn, formatRupiah } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const isOutOfStock = product.stock <= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isOutOfStock}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 text-left transition-all duration-300 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 active:scale-[0.98]",
        isOutOfStock && "cursor-not-allowed opacity-60 grayscale",
      )}
    >
      {/* Visual Accent */}
      <div className="absolute top-0 right-0 -mr-4 -mt-4 h-16 w-16 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors" />

      {/* Stock Badge */}
      <div
        className={cn(
          "absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
          isOutOfStock
            ? "bg-destructive/10 text-destructive"
            : "bg-emerald-500/10 text-emerald-500",
        )}
      >
        {isOutOfStock ? "Habis" : `${product.stock} Tersedia`}
      </div>

      {/* Icon Wrapper */}
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-300">
        <PackageOpen size={28} strokeWidth={1.5} />
      </div>

      {/* Info Section */}
      <div className="space-y-1">
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
          {product.name}
        </h3>
        <p className="font-mono text-lg font-black tracking-tighter text-foreground">
          {formatRupiah(Number(product.price))}
        </p>
      </div>

      {/* Add Indicator */}
      <div className="absolute bottom-4 right-4 translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Plus size={18} />
        </div>
      </div>
    </button>
  );
}
