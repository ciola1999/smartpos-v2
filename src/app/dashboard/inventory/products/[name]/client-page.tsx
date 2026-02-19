"use client";

import { useSession } from "next-auth/react"; // Sesuaikan dengan auth provider kamu
import { AdjustStockDialog } from "@/components/inventory/adjust-stock-dialog";
import { StockHistoryTable } from "@/components/inventory/stock-history-table";
import { StockLabel } from "@/components/inventory/stock-label";
import { Separator } from "@/components/ui/separator";

// Contoh data props (biasanya didapat dari params atau fetch detail produk)
const MOCK_PRODUCT = {
  id: "uuid-produk-kopi-susu",
  name: "Kopi Susu Gula Aren",
  type: "product", // atau "ingredient"
};

const ACTIVE_WAREHOUSE_ID = "uuid-gudang-utama"; // Biasa didapat dari Global Store / Context

export function ProductDetailClient() {
  // Ambil user ID dari session
  const { data: session } = useSession();
  const userId = session?.user?.name || "unknown-user";

  // Konstruksi Target Object (Polymorphic)
  const target = {
    productId: MOCK_PRODUCT.type === "product" ? MOCK_PRODUCT.id : null,
    ingredientId: MOCK_PRODUCT.type === "ingredient" ? MOCK_PRODUCT.id : null,
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {MOCK_PRODUCT.name}
          </h1>
          <p className="text-muted-foreground">Detail Manajemen Stok</p>
        </div>

        {/* ACTION BUTTON */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground uppercase">
              Stok Tersedia
            </span>
            {/* Real-time Badge */}
            <StockLabel
              target={target}
              warehouseId={ACTIVE_WAREHOUSE_ID}
              className="text-lg px-4"
            />
          </div>

          {/* Modal Form */}
          <AdjustStockDialog
            target={target}
            itemName={MOCK_PRODUCT.name}
            warehouseId={ACTIVE_WAREHOUSE_ID}
            userId={userId}
          />
        </div>
      </div>

      <Separator />

      {/* HISTORY TABLE */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Riwayat Pergerakan Stok</h3>
        <StockHistoryTable target={target} warehouseId={ACTIVE_WAREHOUSE_ID} />
      </div>
    </div>
  );
}
