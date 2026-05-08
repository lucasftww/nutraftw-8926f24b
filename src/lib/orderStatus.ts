/**
 * Status do pedido — labels + classes de cor compatíveis com tema claro
 * (área do cliente) e dark (admin). Usamos tokens semânticos com /15 +
 * ring para que funcionem em ambos os temas sem manchas brancas.
 */
export type OrderStatusKey =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export const ORDER_STATUS_LABELS: Record<OrderStatusKey, { label: string; color: string }> = {
  pending:    { label: "Aguardando pagamento", color: "bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/25" },
  paid:       { label: "Pago",                 color: "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25" },
  processing: { label: "Em preparação",        color: "bg-primary/15 text-primary ring-1 ring-primary/25" },
  shipped:    { label: "Enviado",              color: "bg-indigo-500/15 text-indigo-500 ring-1 ring-indigo-500/25" },
  delivered:  { label: "Entregue",             color: "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25" },
  cancelled:  { label: "Cancelado",            color: "bg-destructive/15 text-destructive ring-1 ring-destructive/25" },
  refunded:   { label: "Reembolsado",          color: "bg-muted text-muted-foreground ring-1 ring-border" },
};

export function getOrderStatus(status: string | null | undefined) {
  if (!status) return { label: "—", color: "bg-muted text-muted-foreground ring-1 ring-border" };
  return (
    ORDER_STATUS_LABELS[status as OrderStatusKey] ?? {
      label: status,
      color: "bg-muted text-muted-foreground ring-1 ring-border",
    }
  );
}