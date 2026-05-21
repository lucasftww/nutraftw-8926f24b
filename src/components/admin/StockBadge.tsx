import { Badge } from "@/components/ui/badge";

/**
 * Badge de estoque consistente em toda a área admin.
 *  0   → "Esgotado" (soft-destructive)
 *  1-4 → "Baixo · N" (soft-warning) — usa token warning, não amber hardcoded
 *  ≥5  → número neutro
 */
export function StockBadge({ stock }: { stock: number }) {
  const n = Number(stock ?? 0);

  if (n === 0) {
    return <Badge variant="soft-destructive">Esgotado</Badge>;
  }
  if (n < 5) {
    return (
      <Badge variant="soft-warning" className="tabular-nums">
        Baixo · {n}
      </Badge>
    );
  }
  return <span className="text-sm font-medium text-muted-foreground tabular-nums">{n}</span>;
}
