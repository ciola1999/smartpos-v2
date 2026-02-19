import {
  Banknote,
  CreditCard,
  type LucideIcon,
  QrCode,
  Smartphone,
  Split,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { CheckoutParams } from "@/hooks/use-pos";
import { formatRupiah } from "@/lib/utils/currency";
import { PAYMENT_METHODS } from "@/lib/validations/order";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirm: (params: CheckoutParams) => void;
  isProcessing: boolean;
}

const PAYMENT_CONFIG: Record<
  (typeof PAYMENT_METHODS)[number],
  { label: string; icon: LucideIcon }
> = {
  cash: { label: "Tunai", icon: Banknote },
  qris: { label: "QRIS", icon: QrCode },
  debit: { label: "Debit", icon: CreditCard },
  credit: { label: "Kredit", icon: CreditCard },
  transfer: { label: "Transfer", icon: Smartphone },
  split: { label: "Split", icon: Split },
};

export function PaymentModal({
  open,
  onOpenChange,
  totalAmount,
  onConfirm,
  isProcessing,
}: PaymentModalProps) {
  // State
  const [method, setMethod] =
    useState<(typeof PAYMENT_METHODS)[number]>("cash");
  const [cashAmountStr, setCashAmountStr] = useState<string>("");
  const [note, setNote] = useState("");
  const [referenceId, setReferenceId] = useState("");

  // ✅ PERBAIKAN: Hapus totalAmount dari dependency array
  // Reset state HANYA saat modal dibuka (open berubah menjadi true)
  useEffect(() => {
    if (open) {
      setMethod("cash");
      setCashAmountStr("");
      setNote("");
      setReferenceId("");
    }
  }, [open]);

  // Kalkulasi Logic
  const numericCash = parseFloat(cashAmountStr) || 0;
  const change = numericCash - totalAmount;

  const isCashInsufficient = method === "cash" && numericCash < totalAmount;

  // Smart Suggestions
  const cashSuggestions = useMemo(() => {
    if (totalAmount <= 0) return [];

    const suggestions = new Set<number>();
    suggestions.add(totalAmount);

    if (totalAmount < 20000) suggestions.add(20000);
    if (totalAmount < 50000) suggestions.add(50000);
    if (totalAmount < 100000) suggestions.add(100000);

    const next50 = Math.ceil(totalAmount / 50000) * 50000;
    const next100 = Math.ceil(totalAmount / 100000) * 100000;

    if (next50 > totalAmount) suggestions.add(next50);
    if (next100 > totalAmount) suggestions.add(next100);

    return Array.from(suggestions)
      .sort((a, b) => a - b)
      .slice(0, 4);
  }, [totalAmount]);

  const handlePay = () => {
    onConfirm({
      paymentMethod: method,
      amountPaid: method === "cash" ? numericCash : totalAmount,
      orderType: "dine_in",
      note: note.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
          <DialogDescription>
            Selesaikan transaksi sebesar{" "}
            <span className="font-bold text-primary">
              {formatRupiah(totalAmount)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          {/* 1. Pilih Metode Pembayaran */}
          <RadioGroup
            value={method}
            onValueChange={(v) =>
              setMethod(v as (typeof PAYMENT_METHODS)[number])
            }
            className="grid grid-cols-3 sm:grid-cols-5 gap-2"
          >
            {PAYMENT_METHODS.filter((m) => m !== "split").map((m) => {
              const config = PAYMENT_CONFIG[m];
              return (
                <div key={m}>
                  <RadioGroupItem value={m} id={m} className="peer sr-only" />
                  <Label
                    htmlFor={m}
                    className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-transparent p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary cursor-pointer h-20 transition-all"
                  >
                    <config.icon className="mb-2 h-5 w-5" />
                    <span className="text-[10px] font-medium text-center">
                      {config.label}
                    </span>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {/* 2. Area Input Dinamis */}
          <div className="space-y-4 bg-muted/30 p-4 rounded-lg border">
            {method === "cash" ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cash-input">Uang Diterima</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">
                      Rp
                    </span>
                    <Input
                      id="cash-input"
                      type="number"
                      className="pl-10 text-xl font-bold h-12"
                      placeholder="0"
                      value={cashAmountStr}
                      onChange={(e) => setCashAmountStr(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {cashSuggestions.map((amt) => (
                    <Button
                      key={amt}
                      variant="outline"
                      size="sm"
                      className="text-xs h-9"
                      onClick={() => setCashAmountStr(amt.toString())}
                    >
                      {amt === totalAmount ? "Uang Pas" : formatRupiah(amt)}
                    </Button>
                  ))}
                </div>

                <div
                  className={`flex justify-between items-center p-3 rounded-lg border ${change < 0 ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}`}
                >
                  <span className="font-medium text-sm text-muted-foreground">
                    Kembalian
                  </span>
                  <span
                    className={`font-bold text-xl ${change < 0 ? "text-red-500" : "text-green-600"}`}
                  >
                    {change < 0 ? "-" : formatRupiah(change)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="p-3 bg-blue-50 text-blue-700 rounded border border-blue-100 text-sm">
                  Silakan proses pembayaran via mesin EDC / QRIS sebesar{" "}
                  <strong>{formatRupiah(totalAmount)}</strong>.
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ref-id">Nomor Referensi (Opsional)</Label>
                  <Input
                    id="ref-id"
                    placeholder="Contoh: 004215"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 pt-2 border-t">
              <Label htmlFor="order-note" className="text-xs">
                Catatan Pesanan
              </Label>
              <Textarea
                id="order-note"
                placeholder="Cth: Meja 5, Dibungkus pisah..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-16 resize-none text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={handlePay}
            disabled={isProcessing || isCashInsufficient || totalAmount <= 0}
            className="w-full sm:w-auto font-bold px-8"
          >
            {isProcessing
              ? "Memproses..."
              : `Bayar ${formatRupiah(totalAmount)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
