import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Package, ShoppingBag, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";

/**
 * Paleta de comandos global do admin (Cmd/Ctrl+K).
 * - Atalhos para tabs do painel
 * - Busca server-side em produtos (nome / princípio ativo)
 * - Busca em pedidos (id curto / nome do cliente / CPF)
 *
 * Acessibilidade:
 * - role="dialog" + aria-modal, fecha com Esc
 * - navegação ↑/↓/Enter pela lista de resultados
 * - foco automático no input ao abrir
 */

type Action = {
  id: string;
  label: string;
  hint?: string;
  group: "Atalhos" | "Produtos" | "Pedidos";
  icon: any;
  run: () => void;
};

type Tab =
  | "dashboard" | "funnel" | "reports" | "products" | "categories"
  | "promotions" | "orders" | "coupons" | "shipping" | "users"
  | "affiliates" | "resends" | "settings" | "diagnostics" | "audit";

const SHORTCUT_TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Ir para Dashboard" },
  { id: "products", label: "Ir para Produtos" },
  { id: "orders", label: "Ir para Pedidos" },
  { id: "categories", label: "Ir para Categorias" },
  { id: "promotions", label: "Ir para Promoções" },
  { id: "coupons", label: "Ir para Cupons" },
  { id: "shipping", label: "Ir para Fretes" },
  { id: "users", label: "Ir para Usuários" },
  { id: "affiliates", label: "Ir para Afiliados" },
  { id: "funnel", label: "Ir para Funil" },
  { id: "reports", label: "Ir para Relatórios" },
  { id: "settings", label: "Ir para Configurações" },
  { id: "audit", label: "Ir para Histórico" },
];

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onOpenOrder,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: Tab) => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Esc para fechar
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  // Busca remota
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function run() {
      if (!debounced) {
        setProducts([]); setOrders([]); return;
      }
      setLoading(true);
      // Sanitiza para evitar injeção de filtros PostgREST via .or() — vírgula
      // separa filtros, parênteses agrupam, etc. Mesmo que o admin tenha
      // permissão, deixar o usuário compor filtros arbitrários é frágil.
      const safe = debounced.replace(/[%_,()*:"'\\]/g, " ").trim();
      if (!safe) {
        setProducts([]); setOrders([]); setLoading(false); return;
      }
      const [pr, or] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, slug, price, stock, image_url, is_active")
          .or(`name.ilike.%${safe}%,active_principle.ilike.%${safe}%`)
          .limit(8),
        supabase
          .from("orders")
          .select("id, total, status, shipping_full_name, shipping_cpf, created_at")
          .or(`shipping_full_name.ilike.%${safe}%,shipping_cpf.ilike.%${safe}%`)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      if (cancelled) return;
      setProducts(pr.data || []);
      setOrders(or.data || []);
      setLoading(false);
    }
    run();
    return () => { cancelled = true; };
  }, [debounced, open]);

  const actions: Action[] = useMemo(() => {
    const q = debounced.toLowerCase();
    const list: Action[] = [];
    SHORTCUT_TABS
      .filter((t) => !q || t.label.toLowerCase().includes(q))
      .forEach((t) =>
        list.push({
          id: `tab:${t.id}`,
          label: t.label,
          group: "Atalhos",
          icon: ArrowRight,
          run: () => { onNavigate(t.id); onClose(); },
        })
      );
    products.forEach((p) =>
      list.push({
        id: `prod:${p.id}`,
        label: p.name,
        hint: `${formatBRL(p.price)} · stock ${p.stock}${p.is_active ? "" : " · inativo"}`,
        group: "Produtos",
        icon: Package,
        run: () => { window.open(`/produto/${p.slug}`, "_blank"); onClose(); },
      })
    );
    orders.forEach((o) =>
      list.push({
        id: `ord:${o.id}`,
        label: `#${o.id.slice(0, 8)} · ${o.shipping_full_name || "—"}`,
        hint: `${formatBRL(o.total)} · ${o.status}`,
        group: "Pedidos",
        icon: ShoppingBag,
        run: () => { onOpenOrder(o.id); onClose(); },
      })
    );
    return list;
  }, [products, orders, debounced, onClose, onNavigate, onOpenOrder]);

  // Navegação por teclado
  useEffect(() => { setActive(0); }, [debounced, products, orders]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(actions.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        actions[active]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, actions, active]);

  // Scroll item ativo à vista
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  // Agrupa preservando ordem (Atalhos → Produtos → Pedidos)
  const groups: { name: string; items: { a: Action; idx: number }[] }[] = [];
  actions.forEach((a, idx) => {
    let g = groups.find((g) => g.name === a.group);
    if (!g) { g = { name: a.group, items: [] }; groups.push(g); }
    g.items.push({ a, idx });
  });

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Busca global"
    >
      <div
        className="w-full max-w-xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produtos, pedidos ou ir para…"
            className="flex-1 h-12 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
            aria-label="Termo de busca"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {actions.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {debounced ? "Nada encontrado." : "Comece a digitar para buscar produtos ou pedidos."}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="py-1">
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{g.name}</div>
                {g.items.map(({ a, idx }) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      data-idx={idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={a.run}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm ${idx === active ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-70" />
                      <span className="flex-1 truncate font-medium">{a.label}</span>
                      {a.hint && <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{a.hint}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="hidden sm:flex items-center justify-between gap-3 px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
          <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border">↑↓</kbd> navegar · <kbd className="px-1 py-0.5 rounded bg-muted border border-border">Enter</kbd> abrir</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted border border-border">Cmd/Ctrl + K</kbd> alternar</span>
        </div>
      </div>
    </div>
  );
}