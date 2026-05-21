import { useRef } from "react";
import { ChevronLeft, ChevronRight, Tag } from "lucide-react";

/**
 * Linha horizontal de chips de categorias — UX clássica de marketplaces BR.
 * Mobile: scroll horizontal nativo + snap-x.
 * Desktop: scroll horizontal + setinhas laterais ao hover.
 * Chip selecionado: bg-primary + ring sutil; demais: bg-muted/60.
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

  const scrollBy = (delta: number) =>
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  const hasSelection = selectedSlugs.size > 0;

  const scrollArrow =
    "hidden md:flex absolute top-1/2 -translate-y-1/2 z-[1] h-8 w-8 items-center justify-center rounded-full bg-card border border-border shadow-card opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted";

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => scrollBy(-220)}
        aria-label="Rolar categorias para a esquerda"
        className={`${scrollArrow} left-0`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <ul
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto snap-x scrollbar-none pb-1 md:px-9"
        aria-label="Categorias do catálogo"
        style={{ scrollbarWidth: "none" }}
      >
        {hasSelection && (
          <li className="shrink-0 snap-start">
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm-plus font-semibold border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
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
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm-plus font-semibold transition-all active:scale-95 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-soft ring-2 ring-primary/30"
                    : "bg-muted/50 text-foreground/80 hover:bg-muted border border-border/40 hover:border-primary/30"
                }`}
              >
                <span className="whitespace-nowrap">{c.name}</span>
                {count != null && count > 0 && (
                  <span
                    className={`text-2xs tabular-nums leading-none ${
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

      <button
        type="button"
        onClick={() => scrollBy(220)}
        aria-label="Rolar categorias para a direita"
        className={`${scrollArrow} right-0`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
