import { Edit2, Minus, Plus, Tag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CartItem as CartItemType } from "@/hooks/use-pos";
import { formatRupiah } from "@/lib/utils/currency";

interface CartItemProps {
  item: CartItemType;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onUpdateDetails: (
    id: string,
    updates: { discount?: number; note?: string },
  ) => void;
}

export function CartItemRow({
  item,
  onUpdateQty,
  onRemove,
  onUpdateDetails,
}: CartItemProps) {
  // State lokal untuk handle input delay/debounce (opsional tapi bagus untuk UX)
  const [discountInput, setDiscountInput] = useState(item.discount.toString());
  const [noteInput, setNoteInput] = useState(item.note || "");

  // Sinkronisasi state lokal jika parent berubah
  useEffect(() => {
    setDiscountInput(item.discount.toString());
    setNoteInput(item.note || "");
  }, [item.discount, item.note]);

  // Kalkulasi Harga
  const subtotalBeforeDiscount = item.price * item.quantity;
  const totalItemPrice = Math.max(0, subtotalBeforeDiscount - item.discount);

  // Handler update detail saat Popover ditutup atau Input onBlur
  const handleSaveDetails = () => {
    let newDiscount = parseFloat(discountInput);
    if (Number.isNaN(newDiscount) || newDiscount < 0) newDiscount = 0;

    // Safety: Diskon tidak boleh lebih besar dari harga total barang
    if (newDiscount > subtotalBeforeDiscount) {
      newDiscount = subtotalBeforeDiscount;
      setDiscountInput(newDiscount.toString());
    }

    onUpdateDetails(item.rowId, {
      discount: newDiscount,
      note: noteInput.trim(),
    });
  };

  return (
    <div className="flex flex-col p-3 border-b last:border-0 hover:bg-muted/10 transition-colors group">
      {/* ---------------------------------------------------------------------- */}
      {/* BARIS 1: INFO UTAMA (NAMA & HARGA)                                     */}
      {/* ---------------------------------------------------------------------- */}
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm text-foreground truncate">
              {item.name}
            </h4>
            {/* Tampilkan SKU sebagai bantuan identifikasi */}
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {item.sku}
            </span>
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground mt-0.5 items-center">
            <span>
              {item.quantity} x {formatRupiah(item.price)}
            </span>

            {/* Badge Varian (Opsional, karena nama sudah mengandung varian) */}
            {item.variantId && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1 py-0 font-normal border-primary/20 text-primary/80"
              >
                Varian
              </Badge>
            )}
          </div>

          {/* Indikator Note & Diskon di List */}
          {(item.note || item.discount > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-left-1">
              {item.discount > 0 && (
                <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 dark:bg-red-900/30 dark:text-red-300">
                  <Tag size={10} /> -{formatRupiah(item.discount)}
                </span>
              )}
              {item.note && (
                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 italic max-w-full truncate">
                  "{item.note}"
                </span>
              )}
            </div>
          )}
        </div>

        {/* Total Harga Per Baris */}
        <div className="text-right">
          <div className="font-bold text-sm">
            {formatRupiah(totalItemPrice)}
          </div>
          {item.discount > 0 && (
            <div className="text-[10px] text-muted-foreground line-through decoration-red-500/50">
              {formatRupiah(subtotalBeforeDiscount)}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* BARIS 2: KONTROL (QTY & EDIT)                                          */}
      {/* ---------------------------------------------------------------------- */}
      <div className="flex items-center justify-between mt-1">
        {/* QTY Control */}
        <div className="flex items-center bg-background border rounded-md h-8 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-full w-8 rounded-none rounded-l-md hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={() =>
              item.quantity === 1
                ? onRemove(item.rowId)
                : onUpdateQty(item.rowId, -1)
            }
            aria-label="Kurangi jumlah"
          >
            {item.quantity === 1 ? (
              <Trash2 size={14} className="text-red-500" />
            ) : (
              <Minus size={14} />
            )}
          </Button>

          <span className="w-10 text-center text-sm font-semibold tabular-nums">
            {item.quantity}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-full w-8 rounded-none rounded-r-md hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={() => onUpdateQty(item.rowId, 1)}
            disabled={item.trackInventory && item.quantity >= item.maxStock}
            aria-label="Tambah jumlah"
          >
            <Plus size={14} />
          </Button>
        </div>

        {/* Edit Details (Popover) */}
        <Popover onOpenChange={(open) => !open && handleSaveDetails()}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 px-2"
            >
              <Edit2 size={12} className="mr-1.5" />
              {item.discount > 0 || item.note
                ? "Edit Detail"
                : "Tambah Catatan/Diskon"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end" side="left">
            <div className="grid gap-4">
              <div className="space-y-1 border-b pb-2">
                <h4 className="font-semibold text-sm">Detail Item</h4>
                <p className="text-xs text-muted-foreground truncate">
                  {item.name}
                </p>
              </div>

              <div className="grid gap-3">
                {/* Input Diskon */}
                <div className="grid gap-1.5">
                  <div className="flex justify-between">
                    <Label
                      htmlFor={`discount-${item.rowId}`}
                      className="text-xs font-medium"
                    >
                      Potongan Harga (Total)
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      Maks: {formatRupiah(subtotalBeforeDiscount)}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      id={`discount-${item.rowId}`}
                      type="number"
                      className="pl-9 h-9 text-sm"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      onBlur={handleSaveDetails}
                      min={0}
                      max={subtotalBeforeDiscount}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Input Catatan */}
                <div className="grid gap-1.5">
                  <Label
                    htmlFor={`note-${item.rowId}`}
                    className="text-xs font-medium"
                  >
                    Catatan Khusus
                  </Label>
                  <Input
                    id={`note-${item.rowId}`}
                    className="h-9 text-sm"
                    placeholder="Contoh: Jangan pedas, Bungkus dipisah..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onBlur={handleSaveDetails}
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={handleSaveDetails}
                >
                  Simpan Perubahan
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
