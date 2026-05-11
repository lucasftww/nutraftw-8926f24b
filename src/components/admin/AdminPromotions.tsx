import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GripVertical, Search, Tag, Plus, X, Loader2, History, RotateCcw } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { ProductThumb } from "@/components/admin/ProductThumb";
import { EmptyState } from "@/components/admin/EmptyState";
import { friendlyErrorMessage } from "@/lib/friendlyError";

type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  is_on_offer: boolean;
  offer_order: number;
};

type PromoHistoryRow = {
  id: string;
  product_id: string;
  original_price: number;
  sale_price: number;
  discount_percent: number;
  started_at: string;
  ended_at: string | null;
};

/**
 * Painel de promoções com drag-and-drop.
 * - Lista à esquerda: produtos atualmente em promoção (arrastar para reordenar)
 * - Lista à direita: produtos disponíveis (clicar p/ adicionar à promoção)
 * - A ordem dos produtos em promoção define a ordem do topo no catálogo público.
 */
export function AdminPromotions() {
  const qc = useQueryClient();
  const [promos, setPromos] = useState<Product[]>([]);
  const [available, setAvailable] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [lastByProduct, setLastByProduct] = useState<Record<string, PromoHistoryRow>>({});
  const [historyOpen, setHistoryOpen] = useState<Product | null>(null);
  const [historyRows, setHistoryRows] = useState<PromoHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const overIndex = useRef<number | null>(null);
  const [dragVer, setDragVer] = useState(0); // força re-render durante drag

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,slug,price,sale_price,image_url,is_on_offer,offer_order" as any)
      .eq("is_active", true);
    if (error) {
      toast.error("Erro ao carregar produtos: " + friendlyErrorMessage(error));
      setLoading(false);
      return;
    }
    const list = (data ?? []) as unknown as Product[];
    const onOffer = list
      .filter((p) => p.is_on_offer)
      .sort((a, b) => (a.offer_order ?? 9999) - (b.offer_order ?? 9999));
    const off = list
      .filter((p) => !p.is_on_offer)
      .sort((a, b) => a.name.localeCompare(b.name));
    setPromos(onOffer);
    setAvailable(off);
    // Última promoção registrada por produto (para mostrar "Reaplicar R$ X")
    const { data: hist } = await (supabase as any)
      .from("product_promo_history")
      .select("id,product_id,original_price,sale_price,discount_percent,started_at,ended_at")
      .order("started_at", { ascending: false });
    const map: Record<string, PromoHistoryRow> = {};
    for (const row of (hist ?? []) as PromoHistoryRow[]) {
      if (!map[row.product_id]) map[row.product_id] = row;
    }
    setLastByProduct(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function onDragStart(idx: number) {
    dragIndex.current = idx;
  }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    overIndex.current = idx;
    setDragVer((v) => v + 1);
  }
  function onDragEnd() {
    const from = dragIndex.current;
    const to = overIndex.current;
    dragIndex.current = null;
    overIndex.current = null;
    setDragVer((v) => v + 1);
    if (from === null || to === null || from === to) return;
    setPromos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function saveOrder() {
    if (promos.length === 0) return;
    setSaving(true);
    try {
      // Paralelo com allSettled — antes era sequencial (N× round-trip).
      // Skip no-op para não disparar requests sem mudança real.
      const updates = promos
        .map((p, i) => ({ p, targetOrder: (i + 1) * 10 }))
        .filter(({ p, targetOrder }) => p.offer_order !== targetOrder)
        .map(({ p, targetOrder }) =>
          supabase
            .from("products")
            .update({ offer_order: targetOrder } as any)
            .eq("id", p.id)
        );
      if (updates.length === 0) {
        toast.info("Nenhuma alteração na ordem");
        setSaving(false);
        return;
      }
      const results = await Promise.allSettled(updates);
      const failed = results.filter(
        (r) => r.status === "rejected" || (r.value as { error?: unknown })?.error
      );
      if (failed.length > 0) {
        const firstErr = failed[0];
        const msg = firstErr.status === "rejected"
          ? String(firstErr.reason)
          : friendlyErrorMessage((firstErr.value as { error?: unknown }).error);
        throw new Error(msg);
      }
      toast.success("Ordem das promoções salva!");
      // reflete no estado sem refetch
      setPromos((prev) => prev.map((p, i) => ({ ...p, offer_order: (i + 1) * 10 })));
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
    } catch (e: any) {
      toast.error("Erro ao salvar: " + friendlyErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function addToPromo(p: Product) {
    // Sem preço promocional, marcar `is_on_offer=true` mostra o produto na faixa
    // de promoções com o mesmo preço cheio — confunde o cliente. Avisamos.
    if (!p.price || p.price <= 0 || !p.sale_price || p.sale_price <= 0 || p.sale_price >= p.price) {
      toast.warning("Defina um Preço promocional no produto antes de colocar em destaque.", {
        description: `"${p.name}" não tem desconto cadastrado.`,
      });
      return;
    }
    const newOrder = (promos.length + 1) * 10;
    const { error } = await supabase
      .from("products")
      .update({ is_on_offer: true, offer_order: newOrder } as any)
      .eq("id", p.id);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    setAvailable((prev) => prev.filter((x) => x.id !== p.id));
    setPromos((prev) => [...prev, { ...p, is_on_offer: true, offer_order: newOrder }]);
    qc.invalidateQueries({ queryKey: queryKeys.products.all });
    toast.success(`"${p.name}" adicionado às promoções`);
  }

  async function reapplyLastPromo(p: Product) {
    const { data, error } = await (supabase as any).rpc("apply_last_promo", {
      p_product_id: p.id,
    });
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    if (!data) {
      toast.info("Nenhum histórico de promoção válido para reaplicar.");
      return;
    }
    toast.success(`Promoção reaplicada: ${formatBRL(Number(data))}`);
    qc.invalidateQueries({ queryKey: queryKeys.products.all });
    await load();
  }

  async function openHistory(p: Product) {
    setHistoryOpen(p);
    setHistoryLoading(true);
    const { data, error } = await (supabase as any)
      .from("product_promo_history")
      .select("id,product_id,original_price,sale_price,discount_percent,started_at,ended_at")
      .eq("product_id", p.id)
      .order("started_at", { ascending: false });
    if (error) toast.error(friendlyErrorMessage(error));
    setHistoryRows((data ?? []) as PromoHistoryRow[]);
    setHistoryLoading(false);
  }

  async function removeFromPromo(p: Product) {
    const { error } = await supabase
      .from("products")
      .update({ is_on_offer: false } as any)
      .eq("id", p.id);
    if (error) { toast.error(friendlyErrorMessage(error)); return; }
    setPromos((prev) => prev.filter((x) => x.id !== p.id));
    setAvailable((prev) => [...prev, { ...p, is_on_offer: false }].sort((a, b) => a.name.localeCompare(b.name)));
    qc.invalidateQueries({ queryKey: queryKeys.products.all });
    toast.success("Removido das promoções");
  }

  const filteredAvailable = available.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
    });
  }

  if (loading) {
    // Skeleton padronizado — antes era texto + spinner simples (inconsistente
    // com outras telas do admin que usam skeleton-cards animados).
    return (
      <div className="space-y-4">
        <div className="h-10 rounded-2xl bg-muted/50 animate-pulse" />
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
            <div className="h-5 w-1/3 bg-muted/50 rounded animate-pulse mb-3" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
            <div className="h-5 w-1/3 bg-muted/50 rounded animate-pulse mb-3" />
            <div className="h-10 bg-muted/40 rounded-xl animate-pulse mb-2" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Tag className="h-5 w-5 text-secondary" />
            Promoções em destaque
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Arraste os produtos para reordenar. O primeiro da lista aparece no topo do catálogo.
          </p>
        </div>
        <Button onClick={saveOrder} disabled={saving || promos.length === 0} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar ordem
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 min-w-0">
        {/* Coluna 1: Promoções ativas (drag-and-drop) */}
        <div className="bg-card rounded-2xl border border-border p-4 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">
              Em promoção ({promos.length})
            </h3>
          </div>
          {promos.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="Nenhum produto em destaque"
              description="Clique em + Promo nos produtos disponíveis para adicioná-los aqui — eles aparecerão no topo do catálogo."
              compact
            />
          ) : (
            <ul className="space-y-2">
              {promos.map((p, idx) => {
                const isDragging = dragIndex.current === idx;
                const isOver = overIndex.current === idx && dragIndex.current !== null && dragIndex.current !== idx;
                return (
                  <li
                    key={p.id}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={(e) => onDragOver(e, idx)}
                    onDragEnd={onDragEnd}
                    onDrop={onDragEnd}
                    className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-move
                      ${isDragging ? "opacity-40" : ""}
                      ${isOver ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"}
                    `}
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="w-7 h-7 rounded-full bg-secondary/20 text-secondary text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <ProductThumb src={p.image_url} alt={p.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.sale_price && p.sale_price < p.price ? (
                          <>
                            <span className="line-through opacity-60">{formatBRL(p.price)}</span>{" "}
                            <span className="text-secondary font-bold">{formatBRL(p.sale_price)}</span>
                          </>
                        ) : (
                          formatBRL(p.price)
                        )}
                      </p>
                    </div>
                    {/* Botões SEMPRE visíveis em mobile (não existe hover em touch).
                        No desktop, fade-in no hover do <li> para visual mais limpo. */}
                    <button
                      onClick={() => openHistory(p)}
                      className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:focus-visible:opacity-100"
                      title="Ver histórico de promoções"
                      aria-label="Histórico"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeFromPromo(p)}
                      className="p-2 rounded-lg hover:bg-destructive/15 text-destructive transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:focus-visible:opacity-100"
                      title="Remover da promoção"
                      aria-label="Remover"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Coluna 2: Disponíveis */}
        <div className="bg-card rounded-2xl border border-border p-4 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">
              Disponíveis ({filteredAvailable.length})
            </h3>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {/* h-11 (44px) — WCAG tap target. Antes h-10. text-base mobile
                evita zoom indesejado em iOS Safari ao focar. */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-border bg-background text-base sm:text-sm focus:outline-none focus:border-primary"
            />
          </div>
          {/* max-h menor em mobile: 600px ocupa quase tela inteira do iPhone SE.
              Em md+ mantém 600px para aproveitar viewport horizontal/2-col. */}
          <ul className="space-y-2 max-h-[420px] md:max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredAvailable.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-background hover:border-primary/40 transition-colors"
              >
                <ProductThumb src={p.image_url} alt={p.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(p.price)}
                    {lastByProduct[p.id] && (() => {
                      const h = lastByProduct[p.id];
                      // discount_percent não é populado pelo trigger — calcular se faltar.
                      const pct = Number.isFinite(Number(h.discount_percent)) && Number(h.discount_percent) > 0
                        ? Math.round(Number(h.discount_percent))
                        : (h.original_price > 0
                            ? Math.round(((h.original_price - h.sale_price) / h.original_price) * 100)
                            : 0);
                      return (
                        <span className="ml-2 text-secondary font-semibold">
                          última: {formatBRL(h.sale_price)}
                          {pct > 0 ? ` (-${pct}%)` : ""}
                        </span>
                      );
                    })()}
                  </p>
                </div>
                {lastByProduct[p.id] && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => reapplyLastPromo(p)}
                    className="gap-1 h-8"
                    title={`Reaplicar última promoção (${formatBRL(lastByProduct[p.id].sale_price)})`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reaplicar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addToPromo(p)}
                  className="gap-1 h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Promo
                </Button>
              </li>
            ))}
            {filteredAvailable.length === 0 && (
              <li className="text-center py-8 text-sm text-muted-foreground">
                Nenhum produto encontrado.
              </li>
            )}
          </ul>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Dica: arraste os cartões da esquerda pelo ícone <GripVertical className="inline h-3 w-3" /> para reordenar e clique em <strong>Salvar ordem</strong>.
      </p>

      {/* Modal de histórico */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setHistoryOpen(null)}
        >
          <div
            className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
              <div className="min-w-0">
                <h3 className="font-bold text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Histórico de promoções
                </h3>
                <p className="text-sm text-muted-foreground truncate">{historyOpen.name}</p>
              </div>
              <button
                onClick={() => setHistoryOpen(null)}
                className="p-1.5 rounded-lg hover:bg-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
                </div>
              ) : historyRows.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">
                  Sem histórico de promoções para este produto.
                </p>
              ) : (
                historyRows.map((row) => {
                  const pct = Number.isFinite(Number(row.discount_percent)) && Number(row.discount_percent) > 0
                    ? Math.round(Number(row.discount_percent))
                    : (row.original_price > 0
                        ? Math.round(((row.original_price - row.sale_price) / row.original_price) * 100)
                        : 0);
                  return (
                  <div
                    key={row.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background"
                  >
                    <div className="w-12 h-12 rounded-lg bg-secondary/15 text-secondary font-bold text-sm flex items-center justify-center shrink-0">
                      {pct > 0 ? `-${pct}%` : "—"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        <span className="line-through opacity-60">{formatBRL(row.original_price)}</span>{" "}
                        → <span className="text-secondary">{formatBRL(row.sale_price)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(row.started_at)}
                        {row.ended_at ? ` → ${fmtDate(row.ended_at)}` : " · em andamento"}
                      </p>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}