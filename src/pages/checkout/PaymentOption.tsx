import { QrCode } from "lucide-react";
import { formatBRL } from "@/lib/utils";

/**
 * Cartão de método de pagamento (PIX / Cartão).
 * Bug fix: antes era declarado DENTRO de `Checkout`. Resultado: a cada
 * keystroke nos campos do form, React via uma "função-componente nova"
 * e desmontava/remontava o card inteiro — animações reiniciavam, ARIA
 * resetava, e em mobile alguns toques eram engolidos pela troca rápida
 * de árvore. Movido pra fora, mantém referência estável entre renders.
 */
export function PaymentOption({
  value,
  active,
  onSelect,
  title,
  subtitle,
  icon: Icon,
  badge,
  totalLabel,
  totalValue,
  installment,
}: {
  value: "pix" | "credit_card";
  active: boolean;
  onSelect: (v: "pix" | "credit_card") => void;
  title: string;
  subtitle: string;
  icon: typeof QrCode;
  badge?: { text: string; tone: "secondary" | "muted" };
  totalLabel: string;
  totalValue: number;
  installment?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(value)}
      className={[
        "relative w-full text-left p-4 rounded-2xl border-2 transition-all",
        "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4",
        active
          ? "border-primary bg-primary/5 shadow-md shadow-primary/10 focus-visible:ring-primary/15"
          : "border-border bg-white hover:border-primary/40 focus-visible:ring-primary/10",
      ].join(" ")}
    >
      {badge && (
        <span
          className={[
            "badge-pill absolute -top-2 right-3 font-extrabold shadow-sm ring-2 ring-card",
            badge.tone === "secondary"
              ? "bg-success text-success-foreground badge-pulse"
              : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {badge.text}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
            active ? "border-primary" : "border-muted-foreground/40",
          ].join(" ")}
          aria-hidden
        >
          {active && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
        </div>
        <div
          className={[
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
            active ? "bg-primary text-primary-foreground" : "bg-muted text-primary",
          ].join(" ")}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm leading-tight">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{subtitle}</div>
        </div>
      </div>
      <div className={`mt-3 pt-3 border-t border-dashed ${active ? "border-primary/30" : "border-border"} flex items-end justify-between gap-2`}>
        <div className="text-2xs uppercase tracking-wider font-semibold text-muted-foreground leading-none">
          {totalLabel}
        </div>
        <div className="text-right">
          <div className={`text-lg font-extrabold tabular-nums leading-none ${active ? "text-primary" : "text-foreground"}`}>
            {formatBRL(totalValue)}
          </div>
          {installment && (
            <div className="text-2xs text-muted-foreground mt-1 tabular-nums">{installment}</div>
          )}
        </div>
      </div>
    </button>
  );
}
