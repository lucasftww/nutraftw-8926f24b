import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * Thumbnail de produto padronizado para o admin.
 * - Tamanhos: sm (40), md (48), lg (56), xl (72)
 * - Quando não há imagem: fundo neutro (bg-muted) + ícone discreto.
 * - Quando a imagem falha: troca para o mesmo fallback (sem mostrar quebrada).
 * - Border-radius e proporção quadrada consistentes em toda a área admin.
 */
const SIZES: Record<string, string> = {
  sm: "w-10 h-10 rounded-md",
  md: "w-12 h-12 rounded-lg",
  lg: "w-14 h-14 rounded-lg",
  xl: "w-[72px] h-[72px] rounded-xl",
};

export function ProductThumb({
  src,
  alt = "",
  size = "md",
  className,
}: {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const cls = SIZES[size] ?? SIZES.md;
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div
        aria-hidden
        className={cn(
          cls,
          "shrink-0 inline-flex items-center justify-center bg-muted/60 text-muted-foreground/60 border border-border/60",
          className,
        )}
      >
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={cn(cls, "shrink-0 object-cover bg-muted/60 border border-border/60", className)}
    />
  );
}