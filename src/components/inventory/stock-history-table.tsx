"use client";

import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  AlertCircle,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type InventoryTarget, useInventory } from "@/hooks/use-inventory";

interface StockHistoryTableProps {
  target: InventoryTarget;
  warehouseId?: string;
}

export function StockHistoryTable({
  target,
  warehouseId,
}: StockHistoryTableProps) {
  const { useStockHistory } = useInventory();
  const { data: history, isLoading } = useStockHistory(target, warehouseId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        Belum ada riwayat mutasi stok.
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Cost (HPP)</TableHead>
            <TableHead>Gudang</TableHead>
            <TableHead>User & Ref</TableHead>
            <TableHead>Catatan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((log) => (
            <TableRow key={log.id}>
              {/* 1. TANGGAL */}
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {format(new Date(log.date), "dd MMM yyyy, HH:mm", {
                  locale: id,
                })}
              </TableCell>

              {/* 2. TIPE TRANSACTION */}
              <TableCell>
                <MovementBadge type={log.type} />
              </TableCell>

              {/* 3. QUANTITY (Merah/Hijau) */}
              <TableCell
                className={
                  log.quantity > 0
                    ? "text-green-600 font-bold"
                    : "text-red-600 font-bold"
                }
              >
                {log.quantity > 0 ? "+" : ""}
                {log.quantity}
              </TableCell>

              {/* 4. UNIT COST (Schema: Text -> Format Currency) */}
              <TableCell className="font-mono text-xs">
                {log.unitCost && log.unitCost !== "0"
                  ? new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                    }).format(Number(log.unitCost))
                  : "-"}
              </TableCell>

              {/* 5. GUDANG */}
              <TableCell className="text-sm">
                {log.warehouseName || "Global"}
              </TableCell>

              {/* 6. USER & REFERENCE */}
              <TableCell className="text-xs">
                <div className="font-medium">{log.userName}</div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
                  {log.referenceType?.replace(/_/g, " ")}
                </div>
              </TableCell>

              {/* 7. NOTE */}
              <TableCell
                className="max-w-[200px] truncate text-xs text-muted-foreground"
                title={log.note || ""}
              >
                {log.note || "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Helper Component untuk Badge Tipe
function MovementBadge({ type }: { type: string }) {
  const styles: Record<
    string,
    { label: string; color: string; icon: LucideIcon }
  > = {
    sale: {
      label: "Penjualan",
      color: "bg-blue-100 text-blue-700",
      icon: ArrowDown,
    },
    purchase: {
      label: "Pembelian",
      color: "bg-green-100 text-green-700",
      icon: ArrowUp,
    },
    production: {
      label: "Produksi",
      color: "bg-purple-100 text-purple-700",
      icon: ArrowUp,
    },
    return: {
      label: "Retur",
      color: "bg-orange-100 text-orange-700",
      icon: ArrowRightLeft,
    },
    adjustment: {
      label: "Opname",
      color: "bg-gray-100 text-gray-700",
      icon: ArrowRightLeft,
    },
    damage: {
      label: "Rusak/Basi",
      color: "bg-red-100 text-red-700",
      icon: AlertCircle,
    },
    void: { label: "Void", color: "bg-red-50 text-red-500", icon: AlertCircle },
  };

  const config = styles[type] || {
    label: type,
    color: "bg-gray-100",
    icon: ArrowRightLeft,
  };
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${config.color} border-transparent bg-opacity-50`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
