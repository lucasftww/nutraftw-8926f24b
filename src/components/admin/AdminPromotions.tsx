import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { GripVertical, Search, Tag, Plus, X, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";

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

/**
 * Painel de promoções com drag-and-drop.
 * - Lista à esquerda: produtos atualmente em promoção (arrastar para reordenar)
 * - Lista à direita: produtos disponíveis (clicar p/ adicionar à promoção)
 * - A ordem dos produtos em promoção define a ordem do topo no catálogo público.
 */
export function AdminPromotions() {
  const [promos, setPromos] = useState<Product[]>([]);
  const [available, setAvailable] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
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
      toast.error("Erro ao carregar produtos: " + error.message);
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
    setSaving(true);
    try {
      // Atribui offer_order = posição * 10 (espaçado p/ inserções futuras)
      const updates = promos.map((p, i) =>
        supabase
          .from("products")
          .update({ offer_order: (i + 1) * 10 } as any)
          .eq("id", p.id)
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
      toast.success("Ordem das promoções salva!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? "desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  async function addToPromo(p: Product) {
    const newOrder = (promos.length + 1) * 10;
    const { error } = await supabase
      .from("products")
      .update({ is_on_offer: true, offer_order: newOrder } as any)
      .eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setAvailable((prev) => prev.filter((x) => x.id !== p.id));
    setPromos((prev) => [...prev, { ...p, is_on_offer: true, offer_order: newOrder }]);
    toast.success(`"${p.name}" adicionado às promoções`);
  }

  async function removeFromPromo(p: Product) {
    const { error } = await supabase
      .from("products")
      .update({ is_on_offer: false } as any)
      .eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setPromos((prev) => prev.filter((x) => x.id !== p.id));
    setAvailable((prev) => [...prev, { ...p, is_on_offer: false }].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success("Removido das promoções");
  }

  const filteredAvailable = available.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando produtos…
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

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Coluna 1: Promoções ativas (drag-and-drop) */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">
              Em promoção ({promos.length})
            </h3>
          </div>
          {promos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma promoção ativa.
              <br />
              Adicione produtos do painel ao lado →
            </div>
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
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted shrink-0" />
                    )}
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
                    <button
                      onClick={() => removeFromPromo(p)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/15 text-destructive transition-opacity"
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
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">
              Disponíveis ({filteredAvailable.length})
            </h3>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto…"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <ul className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredAvailable.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-background hover:border-primary/40 transition-colors"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBRL(p.price)}</p>
                </div>
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
    </div>
  );
}