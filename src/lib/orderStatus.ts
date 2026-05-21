/**
 * Fonte única de verdade para metadados de status e pagamento de pedido.
 *
 * Antes, `STATUS_COLORS`, `STATUS_PT` e `paymentLabel` apareciam DUPLICADOS
 * em pelo menos 3 lugares do admin (AdminOrders, AdminDashboard.Last24h,
 * OrderDetailModal). Risco real de admin ver "shipped" em uma tela e
 * "Enviado" em outra. Este módulo centraliza tudo.
 *
 * Duas paletas de cor:
 *  - `color` (light, cliente):  text-warning / emerald-600 — fundos claros
 *  - `colorDark` (admin dark):  text-warning / emerald-400 — fundos escuros
 *
 * Use `getOrderStatus(status)` no front do cliente e
 * `getAdminOrderStatus(status)` no admin.
 */

export type OrderStatusKey =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

/**
 * Ordem canônica dos status — usar para popular dropdowns/selects.
 * Reflete o ciclo de vida real: pending → paid → processing → shipped → delivered.
 * Cancelled/refunded são terminais.
 */
export const ORDER_STATUSES: readonly OrderStatusKey[] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

/**
 * Labels curtos PT-BR para uso em tabelas/cards do admin (espaço limitado).
 */
export const STATUS_PT: Record<OrderStatusKey, string> = {
  pending: "Pendente",
  paid: "Pago",
  processing: "Processando",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  refunded: "Estornado",
};

/**
 * Labels longos + cor (paleta light) — usado na área do cliente (MyAccount).
 * Tom mais explicativo: "Aguardando pagamento" > "Pendente".
 */
export const ORDER_STATUS_LABELS: Record<OrderStatusKey, { label: string; color: string }> = {
  pending:    { label: "Aguardando pagamento", color: "bg-warning/15 text-warning ring-1 ring-warning/25" },
  paid:       { label: "Pago",                 color: "bg-success/15 text-success ring-1 ring-success/25" },
  processing: { label: "Em preparação",        color: "bg-primary/15 text-primary ring-1 ring-primary/25" },
  shipped:    { label: "Enviado",              color: "bg-indigo-500/15 text-indigo-500 ring-1 ring-indigo-500/25" },
  delivered:  { label: "Entregue",             color: "bg-success/15 text-success ring-1 ring-success/25" },
  cancelled:  { label: "Cancelado",            color: "bg-destructive/15 text-destructive ring-1 ring-destructive/25" },
  refunded:   { label: "Reembolsado",          color: "bg-muted text-muted-foreground ring-1 ring-border" },
};

/**
 * Classes para badges no admin (dark mode). Tons mais CLAROS de
 * amber/emerald (-400) porque o fundo é escuro — text-warning ficaria
 * com contraste ruim sobre o admin.
 */
export const ADMIN_STATUS_COLORS: Record<OrderStatusKey, string> = {
  pending:    "bg-warning/15 text-warning ring-1 ring-warning/25",
  paid:       "bg-success/15 text-success ring-1 ring-success/25",
  processing: "bg-primary/15 text-primary ring-1 ring-primary/25",
  shipped:    "bg-primary/20 text-primary ring-1 ring-primary/25",
  delivered:  "bg-success/20 text-success/80 ring-1 ring-success/30",
  cancelled:  "bg-destructive/15 text-destructive ring-1 ring-destructive/25",
  refunded:   "bg-muted text-muted-foreground ring-1 ring-border",
};

const NEUTRAL_BADGE = "bg-muted text-muted-foreground ring-1 ring-border";

/** Resolve status para `{label, color}` usado na área DO CLIENTE (light mode). */
export function getOrderStatus(status: string | null | undefined): { label: string; color: string } {
  if (!status) return { label: "—", color: NEUTRAL_BADGE };
  return (
    ORDER_STATUS_LABELS[status as OrderStatusKey] ?? {
      label: status,
      color: NEUTRAL_BADGE,
    }
  );
}

/** Resolve status para `{label, color}` usado no ADMIN (dark mode). */
export function getAdminOrderStatus(status: string | null | undefined): { label: string; color: string } {
  if (!status) return { label: "—", color: NEUTRAL_BADGE };
  const key = status as OrderStatusKey;
  return {
    label: STATUS_PT[key] ?? status,
    color: ADMIN_STATUS_COLORS[key] ?? NEUTRAL_BADGE,
  };
}

/** Apenas o label PT-BR curto. Use quando só precisar do texto. */
export function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_PT[status as OrderStatusKey] ?? status;
}

/**
 * Rótulo do método de pagamento PT-BR. Centralizado.
 */
export function paymentLabel(pm: string | null | undefined): string {
  if (!pm) return "—";
  if (pm === "pix") return "PIX";
  if (pm === "credit_card") return "Cartão";
  if (pm === "boleto") return "Boleto";
  return pm;
}
