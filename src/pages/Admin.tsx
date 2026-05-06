import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Search, Menu, X, ChevronRight } from "lucide-react";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { ConfirmProvider } from "@/components/admin/ConfirmDialog";
import { useNewOrdersNotifier } from "@/hooks/useNewOrdersNotifier";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { GROUPS, TABS, TAB_IDS, TAB_TO_GROUP, type Tab } from "@/pages/adminTabs";

const loadAdminDashboard = () => import("@/components/admin/AdminDashboard");
const loadAdminFunnel = () => import("@/components/admin/AdminFunnel");
const loadAdminWishlist = () => import("@/components/admin/AdminWishlist");
const loadWeeklyReport = () => import("@/components/admin/WeeklyReport");
const loadAdminProducts = () => import("@/components/admin/AdminProducts");
const loadAdminCategories = () => import("@/components/admin/AdminCategories");
const loadAdminPromotions = () => import("@/components/admin/AdminPromotions");
const loadAdminOrders = () => import("@/components/admin/AdminOrders");
const loadAdminCoupons = () => import("@/components/admin/AdminCoupons");
const loadAdminShipping = () => import("@/components/admin/AdminShipping");
const loadAdminUsers = () => import("@/components/admin/AdminUsers");
const loadAdminAffiliates = () => import("@/components/admin/AdminAffiliates");
const loadAdminSettings = () => import("@/components/admin/AdminSettings");
const loadAdminDiagnostics = () => import("@/components/admin/AdminDiagnostics");
const loadAdminAuditLog = () => import("@/components/admin/AdminAuditLog");

const tabPreloaders: Record<Tab, () => Promise<unknown>> = {
  dashboard: loadAdminDashboard,
  funnel: loadAdminFunnel,
  wishlist: loadAdminWishlist,
  reports: loadWeeklyReport,
  products: loadAdminProducts,
  categories: loadAdminCategories,
  promotions: loadAdminPromotions,
  orders: loadAdminOrders,
  coupons: loadAdminCoupons,
  shipping: loadAdminShipping,
  users: loadAdminUsers,
  affiliates: loadAdminAffiliates,
  settings: loadAdminSettings,
  diagnostics: loadAdminDiagnostics,
  audit: loadAdminAuditLog,
};

const tabComponents: Record<Tab, ComponentType> = {
  dashboard: lazy(async () => ({ default: (await loadAdminDashboard()).AdminDashboard })),
  funnel: lazy(async () => ({ default: (await loadAdminFunnel()).AdminFunnel })),
  wishlist: lazy(async () => ({ default: (await loadAdminWishlist()).AdminWishlist })),
  reports: lazy(async () => ({ default: (await loadWeeklyReport()).WeeklyReport })),
  products: lazy(async () => ({ default: (await loadAdminProducts()).AdminProducts })),
  categories: lazy(async () => ({ default: (await loadAdminCategories()).AdminCategories })),
  promotions: lazy(async () => ({ default: (await loadAdminPromotions()).AdminPromotions })),
  orders: lazy(async () => ({ default: (await loadAdminOrders()).AdminOrders })),
  coupons: lazy(async () => ({ default: (await loadAdminCoupons()).AdminCoupons })),
  shipping: lazy(async () => ({ default: (await loadAdminShipping()).AdminShipping })),
  users: lazy(async () => ({ default: (await loadAdminUsers()).AdminUsers })),
  affiliates: lazy(async () => ({ default: (await loadAdminAffiliates()).AdminAffiliates })),
  settings: lazy(async () => ({ default: (await loadAdminSettings()).AdminSettings })),
  diagnostics: lazy(async () => ({ default: (await loadAdminDiagnostics()).AdminDiagnostics })),
  audit: lazy(async () => ({ default: (await loadAdminAuditLog()).AdminAuditLog })),
};

function AdminTabFallback() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
      Carregando módulo...
    </div>
  );
}

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
  useEffect(() => {
    if (tab === "orders") clear();
  }, [tab, clear]);

  async function logout() {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  }

  const activeGroupId = TAB_TO_GROUP[tab] ?? "overview";
  const currentTab = TABS.find((t) => t.id === tab);
  const currentGroup = GROUPS.find((g) => g.id === activeGroupId);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const ActiveTabComponent = useMemo(() => tabComponents[tab], [tab]);
  const shortcutLabel = navigator.platform.toLowerCase().includes("mac") ? "⌘K" : "Ctrl+K";

  const preloadTab = (id: Tab) => {
    void tabPreloaders[id]();
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* ========== Sidebar fixa (desktop) ========== */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border bg-card/30 sticky top-0 h-screen overflow-y-auto scrollbar-thin">
        <div className="px-5 pt-6 pb-7">
          <div className="text-lg font-medium tracking-tight text-foreground">
           Painel<span className="text-primary">.</span>
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
                    onMouseEnter={() => preloadTab(t.id)}
                    onFocus={() => preloadTab(t.id)}
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
              <div className="text-[11px] text-muted-foreground/80 break-all leading-tight" title={user?.email}>{user?.email}</div>
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
             Painel<span className="text-primary">.</span>
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
                        onTouchStart={() => preloadTab(t.id)}
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
            <kbd className="hidden md:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border">{shortcutLabel}</kbd>
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

          <Suspense fallback={<AdminTabFallback />}>
            <ActiveTabComponent />
          </Suspense>
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
