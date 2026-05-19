import { Check, Clock, CreditCard, Package, Truck, Home, XCircle, RotateCcw } from "lucide-react";
import { type OrderStatusKey } from "@/lib/orderStatus";

/**
 * Timeline visual do ciclo de vida do pedido — mostra ao cliente
 * exatamente em que etapa ele está, com bolinhas conectadas e ícones.
 *
 * Fluxo feliz: pending → paid → processing → shipped → delivered
 * Fluxos terminais: cancelled / refunded (renderizam compacto)
 *
 * Decisões de design:
 * - Mobile: layout vertical (timeline scroll-friendly, cabe em qualquer tela)
 * - Desktop: horizontal (compacto, scan rápido)
 * - Passos passados/atual = primary; futuros = muted (sem ansiedade visual)
 * - "Atual" pulsa sutilmente (animate-pulse) para reforçar a sensação de
 *   acompanhamento em tempo real
 */

const HAPPY_PATH: Array<{ key: OrderStatusKey; label: string; icon: typeof Clock }> = [
  { key: "pending",    label: "Pedido feito",      icon: Clock },
  { key: "paid",       label: "Pagamento ok",      icon: CreditCard },
  { key: "processing", label: "Em preparação",     icon: Package },
  { key: "shipped",    label: "Enviado",           icon: Truck },
  { key: "delivered",  label: "Entregue",          icon: Home },
];

export function OrderTimeline({ status }: { status: string | null | undefined }) {
  // Estados terminais: mostra um único bloco compacto e para.
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <XCircle className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div>
          <p className="font-bold text-sm text-destructive">Pedido cancelado</p>
          <p className="text-xs text-muted-foreground mt-0.5">Entre em contato pelo WhatsApp se for engano.</p>
        </div>
      </div>
    );
  }
  if (status === "refunded") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <RotateCcw className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div>
          <p className="font-bold text-sm text-foreground">Reembolsado</p>
          <p className="text-xs text-muted-foreground mt-0.5">O valor já foi devolvido pelo método original.</p>
        </div>
      </div>
    );
  }

  const currentIdx = Math.max(
    0,
    HAPPY_PATH.findIndex((s) => s.key === status),
  );
  const safeIdx = status && HAPPY_PATH.some((s) => s.key === status) ? currentIdx : 0;

  return (
    <ol
      className="relative grid grid-cols-1 gap-3 sm:grid-cols-5 sm:gap-0"
      aria-label="Progresso do pedido"
    >
      {HAPPY_PATH.map((step, i) => {
        const done = i < safeIdx;
        const current = i === safeIdx;
        const future = i > safeIdx;
        const Icon = done ? Check : step.icon;
        return (
          <li
            key={step.key}
            className="relative flex items-center gap-3 sm:flex-col sm:items-center sm:gap-1.5"
            aria-current={current ? "step" : undefined}
          >
            {/* Linha conectora — vertical no mobile, horizontal no desktop */}
            {i < HAPPY_PATH.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 sm:left-1/2 sm:top-4 sm:h-0.5 sm:w-full sm:translate-x-[15px] sm:translate-y-0 transition-colors ${
                  done ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <span
              className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 transition-all ${
                done
                  ? "bg-primary text-primary-foreground ring-primary"
                  : current
                    ? "bg-primary/15 text-primary ring-primary animate-pulse"
                    : "bg-background text-muted-foreground ring-border"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 sm:text-center">
              <p
                className={`text-[12px] sm:text-[11px] font-bold leading-tight ${
                  future ? "text-muted-foreground" : "text-foreground"
                }`}
              >
                {step.label}
              </p>
              {current && (
                <p className="text-[10px] text-primary font-semibold mt-0.5 hidden sm:block">
                  Agora
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
