/**
 * Badge de estoque consistente em toda a área admin.
 * - 0   → "Esgotado" (vermelho)
 * - 1-4 → "Baixo: N" (âmbar)
 * - ≥5  → "N" (neutro)
 */
export function StockBadge({ stock }: { stock: number }) {
  const n = Number(stock ?? 0);
  if (n === 0) {
    return (
      <span className="badge-pill bg-destructive/15 text-destructive border border-destructive/25">
        Esgotado
      </span>
    );
  }
  if (n < 5) {
    return (
      <span className="badge-pill bg-amber-500/15 text-amber-500 border border-amber-500/25 tabular-nums">
        Baixo · {n}
      </span>
    );
  }
  return <span className="text-sm font-medium text-muted-foreground tabular-nums">{n}</span>;
}