import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSellPosition } from "@/hooks/use-transactions";
import type { PositionBrief } from "@/hooks/use-portfolios";

interface SellModalProps {
  position: PositionBrief;
  portfolioId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SellModal({
  position,
  portfolioId,
  open,
  onOpenChange,
}: SellModalProps) {
  const [shares, setShares] = useState(String(position.shares));
  const [price, setPrice] = useState(
    String(position.current_price ?? position.entry_price)
  );
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const sellMutation = useSellPosition(portfolioId);

  const preview = useMemo(() => {
    const s = parseFloat(shares) || 0;
    const p = parseFloat(price) || 0;
    const total = s * p;
    const costPerShare = position.invested_amount / position.shares;
    const costBasis = costPerShare * s;
    const pnl = total - costBasis;
    const pnlPct = costBasis ? (pnl / costBasis) * 100 : 0;
    return {
      total,
      pnl,
      pnlPct,
      valid: s > 0 && s <= position.shares && p > 0,
    };
  }, [shares, price, position]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview.valid) return;
    sellMutation.mutate(
      {
        positionId: position.id,
        shares: parseFloat(shares),
        price: parseFloat(price),
        trade_date: date || undefined,
        notes: notes || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sell {position.etf_name}</DialogTitle>
          <DialogDescription>
            {position.ticker_yf || position.etf_isin} — holding{" "}
            {position.shares} shares
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Shares to sell
              </label>
              <input
                type="number"
                step="any"
                min="0.000001"
                max={position.shares}
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Sell price
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. took profits, rebalancing..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {preview.valid && (
            <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total proceeds</span>
                <span className="font-medium">
                  {preview.total.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Realized P&L</span>
                <span
                  className={
                    preview.pnl >= 0
                      ? "text-green-600 font-medium"
                      : "text-red-500 font-medium"
                  }
                >
                  {preview.pnl >= 0 ? "+" : ""}
                  {preview.pnl.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ({preview.pnl >= 0 ? "+" : ""}
                  {preview.pnlPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!preview.valid || sellMutation.isPending}
            >
              {sellMutation.isPending ? "Selling..." : "Confirm Sell"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
