import { useRef } from "react";
import { ChevronLeft, ChevronRight, Tag } from "lucide-react";

/**
 * Linha horizontal de chips de categorias — UX clássica de marketplaces BR
 * (ML, Magalu, Shopee). Permite filtrar com 1 tap, sem abrir o drawer.
 *
 * - Mobile: scroll horizontal nativo + snap-x para "ancorar" no chip
 * - Desktop: scroll horizontal + setinhas laterais para navegar
 * - Chip selecionado: bg-primary + ring sutil; demais: bg-muted/60
 * - Inclui chip "Tudo" que limpa filtros
 */
interface CategoryLike {
  id: string;
  slug: string;
  name: string;
}

export function CategoryChips({
  categories,
  selectedSlugs,
  onToggle,
  onClear,
  counts,
}: {
  categories: CategoryLike[];
  selectedSlugs: Set<string>;
  onToggle: (slug: string) => void;
  onClear: () => void;
  counts?: Map<string, number>;
}) {
  const scrollRef = useRef<HTMLUListElement | null>(null);

  if (categories.length === 0) return null;

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  const hasSelection = selectedSlugs.size > 0;

  return (
    <div className="relative group">
      {/* Setinha esquerda — só aparece no desktop em hover */}
      <button
        type="button"
        onClick={() => scrollBy(-220)}
        aria-label="Rolar categorias para a esquerda"
        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-[1] h-8 w-8 items-center justify-center rounded-full bg-card border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <ul
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto snap-x scrollbar-none pb-1 md:px-9"
        aria-label="Categorias do catálogo"
        style={{ scrollbarWidth: "none" }}
      >
        {/* Chip "Tudo" — só aparece quando há seleção, como atalho de limpar */}
        {hasSelection && (
          <li className="shrink-0 snap-start">
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Tag className="h-3.5 w-3.5" />
              Tudo
            </button>
          </li>
        )}

        {categories.map((c) => {
          const active = selectedSlugs.has(c.slug);
          const count = counts?.get(c.slug);
          return (
            <li key={c.id} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onToggle(c.slug)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all active:scale-95 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                    : "bg-muted/50 text-foreground/80 hover:bg-muted border border-border/40 hover:border-primary/30"
                }`}
              >
                <span className="whitespace-nowrap">{c.name}</span>
                {count != null && count > 0 && (
                  <span
                    className={`text-[10.5px] tabular-nums leading-none ${
                      active ? "text-primary-foreground/70" : "text-muted-foreground/70"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Setinha direita */}
      <button
        type="button"
        onClick={() => scrollBy(220)}
        aria-label="Rolar categorias para a direita"
        className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-[1] h-8 w-8 items-center justify-center rounded-full bg-card border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
