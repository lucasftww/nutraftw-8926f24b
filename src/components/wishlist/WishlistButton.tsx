import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWishlist } from "@/hooks/useWishlist";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  productId: string;
  className?: string;
  /** "card" = botão flutuante sobre a imagem; "inline" = inline no detalhe */
  variant?: "card" | "inline";
  size?: "sm" | "md";
}

/**
 * Botão coração reutilizável. Stop-propagation pra funcionar dentro de Link
 * (cards do catálogo). Se deslogado, sugere login com toast + redirect.
 */
export function WishlistButton({ productId, className, variant = "card", size = "md" }: Props) {
  const { ids, toggle, isAuthed, isPending } = useWishlist();
  const nav = useNavigate();
  const isFav = ids.has(productId);

  const handle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthed) {
      toast.info("Faça login para salvar favoritos", {
        description: "Você poderá voltar a qualquer momento e finalizar a compra.",
        action: { label: "Entrar", onClick: () => nav("/login?redirect=/favoritos") },
      });
      return;
    }
    toggle(productId);
  };

  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconDim = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={isPending}
        aria-pressed={isFav}
        aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        className={cn(
          "inline-flex items-center gap-2 h-11 px-4 rounded-2xl border text-sm font-semibold transition-all active:scale-[0.98]",
          isFav
            ? "bg-destructive/10 border-destructive/30 text-destructive"
            : "bg-background border-border text-foreground hover:border-destructive/30 hover:text-destructive",
          className,
        )}
      >
        <Heart className={cn("h-4 w-4", isFav && "fill-current")} />
        {isFav ? "Favoritado" : "Favoritar"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={isPending}
      aria-pressed={isFav}
      aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      // backdrop-blur removido: renderiza em CADA card do catálogo (50+
      // instâncias acima da dobra), e cada blur sobre imagem dispara
      // composição cara. `bg-white/95` sólido tem visual quase idêntico
      // sem custo de paint. `transition-colors` em vez de `transition-all`
      // para evitar animar tudo (incluindo box-shadow, transform, etc.).
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-white/95 shadow-sm border border-border/60 transition-colors active:scale-90",
        "hover:border-destructive/40",
        dim,
        isFav ? "text-destructive" : "text-foreground/70",
        className,
      )}
    >
      <Heart className={cn(iconDim, "transition-transform", isFav && "fill-current scale-110")} />
    </button>
  );
}