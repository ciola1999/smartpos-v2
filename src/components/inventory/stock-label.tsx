"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type InventoryTarget, useInventory } from "@/hooks/use-inventory";
import { cn } from "@/lib/utils";

interface StockLabelProps {
  target: InventoryTarget; // { productId: ... } atau { ingredientId: ... }
  warehouseId?: string;
  className?: string;
}

export function StockLabel({
  target,
  warehouseId,
  className,
}: StockLabelProps) {
  const { useCurrentStock } = useInventory();
  const { data: stock, isLoading } = useCurrentStock(target, warehouseId);

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  const currentStock = stock ?? 0;

  // Logic warna: Merah jika <= 0, Kuning jika < 10, Hijau aman
  const variant =
    currentStock <= 0
      ? "destructive"
      : currentStock < 10
        ? "secondary"
        : "default";

  return (
    <Badge
      variant={variant}
      className={cn("px-3 py-1 text-sm font-mono", className)}
    >
      {currentStock} Unit
    </Badge>
  );
}
