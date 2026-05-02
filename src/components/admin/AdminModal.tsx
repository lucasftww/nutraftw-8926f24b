import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

/**
 * Modal acessível padronizado para o painel admin.
 * - Focus trap (Tab/Shift+Tab ciclam dentro)
 * - Fecha com Escape
 * - role="dialog" + aria-modal + aria-labelledby
 * - Lock de scroll do body
 * - Restaura foco ao fechar (via useFocusTrap)
 *
 * Uso:
 *   <AdminModal open={!!editing} onClose={...} title="Editar produto">
 *     <form>...</form>
 *   </AdminModal>
 */
export function AdminModal({
  open,
  onClose,
  title,
  children,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const ref = useFocusTrap<HTMLDivElement>(open, onClose);
  useBodyScrollLock(open);

  // Animação de entrada simples — só quando muda para open.
  useEffect(() => {
    /* placeholder para futuras transições */
  }, [open]);

  if (!open) return null;

  const sizes: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };
  const titleId = `admin-modal-title-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${sizes[size]} bg-card rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <h2 id={titleId} className="font-bold text-lg sm:text-xl truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="h-9 w-9 -mr-1 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  );
}