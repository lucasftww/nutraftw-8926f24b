import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Estado vazio premium para o painel admin.
 * - Card centralizado com ícone discreto em halo.
 * - Título + subtexto opcional + ação (CTA) opcional.
 * - Use compact={true} dentro de listas internas (modal, drawers).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center mx-auto",
        compact ? "py-8 px-4 max-w-sm" : "py-16 px-6 max-w-md",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "inline-flex items-center justify-center rounded-2xl bg-muted/40 border border-border/60 text-muted-foreground/80 mb-4",
            compact ? "h-10 w-10" : "h-14 w-14",
          )}
          aria-hidden
        >
          <Icon className={compact ? "h-4 w-4" : "h-6 w-6"} />
        </div>
      )}
      <p className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
        {title}
      </p>
      {description && (
        <p className={cn("text-muted-foreground mt-1.5 leading-relaxed", compact ? "text-xs" : "text-sm")}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}