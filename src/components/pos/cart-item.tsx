import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import type { CartItem as CartItemType } from "@/hooks/use-pos";
import { formatRupiah } from "@/lib/utils";

interface CartItemProps {
  item: CartItemType;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function CartItem({ item, onIncrement, onDecrement }: CartItemProps) {
  return (
    <div className="group relative flex items-center gap-4 rounded-2xl border border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        <ShoppingCart size={20} />
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <h4 className="truncate text-sm font-bold text-foreground leading-tight">
          {item.product.name}
        </h4>
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">
          {formatRupiah(Number(item.product.price))}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className="font-mono text-xs font-black text-foreground">
          {formatRupiah(Number(item.product.price) * item.quantity)}
        </span>

        <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
          <button
            type="button"
            onClick={onDecrement}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-card text-muted-foreground shadow-sm transition-all hover:text-destructive active:scale-90"
          >
            {item.quantity === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
          </button>

          <span className="w-5 text-center text-[11px] font-black text-foreground">
            {item.quantity}
          </span>

          <button
            type="button"
            onClick={onIncrement}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-card text-muted-foreground shadow-sm transition-all hover:text-primary active:scale-90"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
