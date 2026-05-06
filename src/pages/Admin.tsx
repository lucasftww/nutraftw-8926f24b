import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Search, LayoutDashboard, Package, Tags, ShoppingBag, Ticket, Truck, Settings, BarChart3, Activity, History, TrendingUp, Users, Handshake, Tag, Menu, X, ChevronRight, Heart } from "lucide-react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { WeeklyReport } from "@/components/admin/WeeklyReport";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { AdminCoupons } from "@/components/admin/AdminCoupons";
import { AdminShipping } from "@/components/admin/AdminShipping";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminDiagnostics } from "@/components/admin/AdminDiagnostics";
import { AdminAuditLog } from "@/components/admin/AdminAuditLog";
import { AdminFunnel } from "@/components/admin/AdminFunnel";
import { AdminWishlist } from "@/components/admin/AdminWishlist";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminAffiliates } from "@/components/admin/AdminAffiliates";
import { AdminPromotions } from "@/components/admin/AdminPromotions";
import { AdminProducts } from "@/components/admin/AdminProducts";
import { AdminCategories } from "@/components/admin/AdminCategories";
import { AdminOrders } from "@/components/admin/AdminOrders";
import { ConfirmProvider } from "@/components/admin/ConfirmDialog";
import { useNewOrdersNotifier } from "@/hooks/useNewOrdersNotifier";
import { CommandPalette } from "@/components/admin/CommandPalette";

type Tab = "dashboard" | "funnel" | "wishlist" | "reports" | "products" | "categories" | "promotions" | "orders" | "coupons" | "shipping" | "users" | "affiliates" | "settings" | "diagnostics" | "audit";

const TAB_IDS: Tab[] = ["dashboard","funnel","wishlist","reports","products","categories","promotions","orders","coupons","shipping","users","affiliates","settings","diagnostics","audit"];

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "funnel", label: "Funil", icon: TrendingUp },
  { id: "wishlist", label: "Favoritos", icon: Heart },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "products", label: "Produtos", icon: Package },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "promotions", label: "Promoções", icon: Tag },
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "coupons", label: "Cupons", icon: Ticket },
  { id: "shipping", label: "Fretes", icon: Truck },
  { id: "users", label: "Usuários", icon: Users },
  { id: "affiliates", label: "Afiliados", icon: Handshake },
  { id: "settings", label: "Configurações", icon: Settings },
  { id: "diagnostics", label: "Diagnóstico", icon: Activity },
  { id: "audit", label: "Histórico", icon: History },
];

// Agrupamento das abas em 5 categorias — reduz cognitive load no mobile e dá
// uma "navegação principal + sub-navegação" mais clara que 13 abas planas.
type Group = { id: string; label: string; icon: any; tabs: Tab[] };
const GROUPS: Group[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard, tabs: ["dashboard", "funnel", "wishlist", "reports"] },
  { id: "catalog",  label: "Catálogo",    icon: Package,         tabs: ["products", "categories", "promotions"] },
  { id: "sales",    label: "Vendas",      icon: ShoppingBag,     tabs: ["orders", "coupons", "shipping"] },
  { id: "people",   label: "Pessoas",     icon: Users,           tabs: ["users", "affiliates"] },
  { id: "system",   label: "Sistema",     icon: Settings,        tabs: ["settings", "diagnostics", "audit"] },
];
const TAB_TO_GROUP: Record<Tab, string> = (() => {
  const m = {} as Record<Tab, string>;
  for (const g of GROUPS) for (const t of g.tabs) m[t] = g.id;
  return m;
})();


export default function Admin() {
  return (
    <div className="dark min-h-screen bg-background text-foreground" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <ConfirmProvider>
        <AdminInner />
      </ConfirmProvider>
    </div>
  );
}

function AdminInner() {
  const { user } = useAuth();
  const nav = useNavigate();
  // Persiste a aba ativa na URL — recarregar mantém o contexto e dá pra
  // compartilhar link direto (?tab=pedidos).
  const [params, setParams] = useSearchParams();
  const urlTab = params.get("tab") as Tab | null;
  const tab: Tab = urlTab && TAB_IDS.includes(urlTab) ? urlTab : "dashboard";
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === "dashboard") next.delete("tab"); else next.set("tab", t);
    setParams(next, { replace: true });
  };

  // Cmd/Ctrl+K abre a paleta de comandos global.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [globalOrderId, setGlobalOrderId] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Notificador realtime de novos pedidos. Limpa o badge ao entrar na aba Pedidos.
  const { unseenCount, clear } = useNewOrdersNotifier();
  useEffect(() => { if (tab === "orders") clear(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  async function logout() {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  }

  const activeGroupId = TAB_TO_GROUP[tab] ?? "overview";
  const currentTab = TABS.find((t) => t.id === tab);
  const currentGroup = GROUPS.find((g) => g.id === activeGroupId);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* ========== Sidebar fixa (desktop) ========== */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border bg-card/30 sticky top-0 h-screen overflow-y-auto scrollbar-thin">
        <div className="px-5 pt-6 pb-7">
          <div className="text-lg font-medium tracking-tight text-foreground">
            Royal Vita<span className="text-primary">.</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">Painel admin</p>
        </div>
        <nav className="flex-1 px-3 pb-4 space-y-5">
          {GROUPS.map((g) => (
            <div key={g.id} className="space-y-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 px-3 mb-1.5 flex items-center gap-2">
                <g.icon className="h-3 w-3" />
                {g.label}
              </div>
              {g.tabs.map((tabId) => {
                const t = TABS.find((x) => x.id === tabId);
                if (!t) return null;
                const active = tab === t.id;
                const showBadge = t.id === "orders" && unseenCount > 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    aria-current={active ? "page" : undefined}
                    className={`group w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all relative ${
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {active && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary rounded-r" style={{ boxShadow: "0 0 6px hsl(var(--primary) / 0.45)" }} />}
                    <t.icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : ""}`} />
                    <span className="flex-1 text-left">{t.label}</span>
                    {showBadge && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold leading-none">
                        {unseenCount > 9 ? "9+" : unseenCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="relative w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold ring-1 ring-primary/25">
              {(user?.email ?? "?").slice(0, 2).toUpperCase()}
              <span aria-hidden className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-foreground truncate">Administrador</div>
              <div className="text-[11px] text-muted-foreground/80 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* ========== Mobile drawer ========== */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            aria-label="Fechar menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <aside className="relative w-72 max-w-[85vw] bg-card border-r border-border flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="text-lg font-medium tracking-tight">
                Royal Vita<span className="text-primary">.</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="p-2 text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-6">
              {GROUPS.map((g) => (
                <div key={g.id} className="space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground px-3 mb-2">{g.label}</div>
                  {g.tabs.map((tabId) => {
                    const t = TABS.find((x) => x.id === tabId);
                    if (!t) return null;
                    const active = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setTab(t.id); setMobileNavOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}
                      >
                        <t.icon className="h-4 w-4" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
            <button onClick={logout} className="m-4 flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-muted-foreground hover:text-destructive border border-border">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </aside>
        </div>
      )}

      {/* ========== Conteúdo principal ========== */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-8 h-14 border-b border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden p-2 -ml-2 text-muted-foreground"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <div className="hidden sm:flex items-center gap-2 text-sm min-w-0">
            <span className="text-muted-foreground truncate">{currentGroup?.label ?? "Admin"}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-foreground font-medium truncate">{currentTab?.label ?? "Dashboard"}</span>
          </div>

          <div className="flex-1" />

          {/* Busca global */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 h-9 px-3 rounded-full bg-background/60 border border-border text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground hover:shadow-[0_0_18px_-4px_hsl(var(--primary)/0.45)] transition-all"
            aria-label="Buscar (Ctrl+K)"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Buscar pedidos, produtos…</span>
            <kbd className="hidden md:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border">⌘K</kbd>
          </button>
        </header>

        {/* Page content */}
        <div className="flex-1 px-3 sm:px-4 md:px-8 py-4 md:py-8">
          {/* Page title */}
          <div className="mb-4 md:mb-7">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">{currentGroup?.label}</p>
            <h1 className="text-lg md:text-2xl font-medium tracking-tight text-foreground flex items-center gap-2">
              {currentTab?.icon && <currentTab.icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />}
              {currentTab?.label ?? "Dashboard"}
            </h1>
          </div>

          {tab === "dashboard" && <AdminDashboard />}
          {tab === "funnel" && <AdminFunnel />}
          {tab === "wishlist" && <AdminWishlist />}
          {tab === "reports" && <WeeklyReport />}
          {tab === "products" && <AdminProducts />}
          {tab === "categories" && <AdminCategories />}
          {tab === "promotions" && <AdminPromotions />}
          {tab === "orders" && <AdminOrders />}
          {tab === "coupons" && <AdminCoupons />}
          {tab === "shipping" && <AdminShipping />}
          {tab === "users" && <AdminUsers />}
          {tab === "affiliates" && <AdminAffiliates />}
          {tab === "settings" && <AdminSettings />}
          {tab === "diagnostics" && <AdminDiagnostics />}
          {tab === "audit" && <AdminAuditLog />}
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(t) => setTab(t as Tab)}
        onOpenOrder={(id) => { setTab("orders"); setGlobalOrderId(id); }}
      />
      {globalOrderId && (
        <OrderDetailModal orderId={globalOrderId} onClose={() => setGlobalOrderId(null)} />
      )}
    </div>
  );
}
