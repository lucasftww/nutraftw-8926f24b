import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Search, Menu, X, ChevronRight, Bell, Sparkles } from "lucide-react";
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
const loadAdminBrands = () => import("@/components/admin/AdminBrands");
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
  brands: loadAdminBrands,
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
  brands: lazy(async () => ({ default: (await loadAdminBrands()).AdminBrands })),
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
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
      ))}
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
    <div className="flex min-h-screen w-full bg-background text-foreground relative">
      {/* Glow decorativo no fundo — dá profundidade ao admin sem distrair.
          Posicionado atrás de tudo (z-0), não interfere em interações. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-brand-cyan/[0.025] blur-3xl" />
      </div>

      {/* ========== Sidebar fixa (desktop) ========== */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border/70 bg-card/40 backdrop-blur-sm sticky top-0 h-screen overflow-y-auto scrollbar-thin z-10">
        {/* Header com logo monogram */}
        <div className="px-5 pt-6 pb-5 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-brand-cyan flex items-center justify-center text-primary-foreground shadow-[0_0_18px_-4px_hsl(var(--primary)/0.5)]">
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm font-bold tracking-tight text-foreground leading-none">
                Painel<span className="text-primary">.</span>
              </div>
              <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground/80 mt-1 leading-none">
                Administrativo
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-5">
          {GROUPS.map((g) => (
            <div key={g.id} className="space-y-0.5">
              <div className="flex items-center gap-2 px-3 mb-2">
                <span className="h-px w-3 bg-primary/40" aria-hidden />
                <p className="text-2xs font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
                  {g.label}
                </p>
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
                    className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm-plus transition-colors relative ${
                      active
                        ? "bg-primary/12 text-primary font-semibold"
                        : "text-muted-foreground/90 hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-primary to-brand-cyan rounded-r"
                        style={{ boxShadow: "0 0 10px -2px hsl(var(--primary) / 0.6)" }}
                        aria-hidden
                      />
                    )}
                    <t.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"}`} strokeWidth={active ? 2.25 : 1.75} />
                    <span className="flex-1 text-left">{t.label}</span>
                    {showBadge && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-secondary-foreground text-2xs font-bold leading-none ring-2 ring-card animate-in zoom-in-50 duration-300">
                        {unseenCount > 9 ? "9+" : unseenCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User card no rodapé — visual mais polido */}
        <div className="border-t border-border/40 p-3">
          <div className="rounded-xl bg-muted/30 border border-border/40 p-2.5 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-brand-cyan/15 text-primary flex items-center justify-center text-2xs font-bold ring-1 ring-primary/20 shrink-0">
                {(user?.email ?? "?").slice(0, 2).toUpperCase()}
                <span aria-hidden className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground leading-tight">Administrador</div>
                <div className="text-2xs text-muted-foreground/80 truncate leading-tight" title={user?.email}>{user?.email}</div>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* ========== Mobile drawer redesenhado ========== */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            aria-label="Fechar menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          />
          <aside
            className="relative w-72 max-w-[85vw] bg-card border-r border-border/70 flex flex-col overflow-y-auto animate-in slide-in-from-left duration-300 shadow-2xl"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            {/* Header com logo monogram */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-brand-cyan flex items-center justify-center text-primary-foreground shadow-[0_0_18px_-4px_hsl(var(--primary)/0.5)]">
                  <Sparkles className="h-4 w-4" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold tracking-tight leading-none">
                    Painel<span className="text-primary">.</span>
                  </div>
                  <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground/80 mt-1 leading-none">
                    Administrativo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Fechar menu"
                className="h-11 w-11 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User card */}
            <div className="px-4 pt-4 pb-2">
              <div className="rounded-xl bg-muted/30 border border-border/40 p-2.5 flex items-center gap-2.5">
                <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-brand-cyan/15 text-primary flex items-center justify-center text-2xs font-bold ring-1 ring-primary/20 shrink-0">
                  {(user?.email ?? "?").slice(0, 2).toUpperCase()}
                  <span aria-hidden className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground leading-tight">Administrador</div>
                  <div className="text-2xs text-muted-foreground/80 truncate leading-tight">{user?.email}</div>
                </div>
              </div>
            </div>

            <nav className="flex-1 px-3 py-3 space-y-5">
              {GROUPS.map((g) => (
                <div key={g.id} className="space-y-0.5">
                  <div className="flex items-center gap-2 px-3 mb-2">
                    <span className="h-px w-3 bg-primary/40" aria-hidden />
                    <p className="text-2xs font-bold uppercase tracking-[0.22em] text-muted-foreground/70">
                      {g.label}
                    </p>
                  </div>
                  {g.tabs.map((tabId) => {
                    const t = TABS.find((x) => x.id === tabId);
                    if (!t) return null;
                    const active = tab === t.id;
                    const showBadge = t.id === "orders" && unseenCount > 0;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setTab(t.id); setMobileNavOpen(false); }}
                        onTouchStart={() => preloadTab(t.id)}
                        className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative ${
                          active
                            ? "bg-primary/12 text-primary font-semibold"
                            : "text-muted-foreground/90 active:bg-muted/40"
                        }`}
                      >
                        {active && (
                          <span
                            className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-gradient-to-b from-primary to-brand-cyan rounded-r"
                            style={{ boxShadow: "0 0 10px -2px hsl(var(--primary) / 0.6)" }}
                            aria-hidden
                          />
                        )}
                        <t.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground/70"}`} strokeWidth={active ? 2.25 : 1.75} />
                        <span className="flex-1 text-left">{t.label}</span>
                        {showBadge && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-secondary-foreground text-2xs font-bold leading-none">
                            {unseenCount > 9 ? "9+" : unseenCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div
              className="border-t border-border/40 p-3"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
            >
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 h-11 px-3 rounded-lg text-sm-plus font-medium text-muted-foreground/90 hover:text-destructive hover:bg-destructive/10 border border-border/60 transition-colors"
              >
                <LogOut className="h-4 w-4" /> Sair da conta
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ========== Conteúdo principal ========== */}
      <main className="flex-1 min-w-0 flex flex-col relative z-10">
        {/* Top bar redesenhada */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-3 sm:px-4 md:px-8 h-16 border-b border-border/60 bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden h-11 w-11 -ml-2 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb refinado — gradient subtle no nome do grupo */}
          <div className="hidden sm:flex items-center gap-2 text-sm min-w-0">
            <span className="text-muted-foreground/70 text-xs uppercase tracking-wider font-semibold truncate">
              {currentGroup?.label ?? "Admin"}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <span className="text-foreground font-bold truncate">{currentTab?.label ?? "Dashboard"}</span>
          </div>

          <div className="flex-1" />

          {/* Indicador de novos pedidos — tap target 44x44 mobile (WCAG). */}
          {unseenCount > 0 && tab !== "orders" && (
            <button
              onClick={() => setTab("orders")}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`${unseenCount} ${unseenCount === 1 ? "pedido novo" : "pedidos novos"}`}
              title="Ver pedidos novos"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
              <span className="absolute top-1.5 right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-secondary text-secondary-foreground text-2xs font-bold leading-none ring-2 ring-card px-1">
                {unseenCount > 9 ? "9+" : unseenCount}
              </span>
            </button>
          )}

          {/* Busca global — h-11 (44px WCAG). Mobile mostra só ícone num círculo. */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="group flex items-center gap-2 h-11 w-11 md:w-auto md:px-3.5 justify-center rounded-full bg-background/70 border border-border/70 text-sm-plus text-muted-foreground hover:border-primary/40 hover:text-foreground hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.5)] transition-all"
            aria-label="Buscar (Ctrl+K)"
          >
            <Search className="h-4 w-4 group-hover:text-primary transition-colors" />
            <span className="hidden md:inline font-medium">Buscar pedidos, produtos…</span>
            <kbd className="hidden md:inline ml-1 text-2xs font-mono px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground border border-border/60">{shortcutLabel}</kbd>
          </button>
        </header>

        {/* Page content */}
        <div className="flex-1 px-3 sm:px-4 md:px-8 py-5 md:py-8">
          {/* Page title — eyebrow + heading + acento gradient */}
          <div className="mb-5 md:mb-7">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-block h-1 w-6 rounded-full bg-gradient-to-r from-primary to-brand-cyan" aria-hidden />
              <p className="text-2xs font-bold uppercase tracking-[0.18em] text-primary/80">
                {currentGroup?.label}
              </p>
            </div>
            <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              {currentTab?.icon && (
                <span className="inline-flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/20">
                  <currentTab.icon className="h-4 w-4 md:h-5 md:w-5 text-primary" strokeWidth={2.2} />
                </span>
              )}
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
