import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ShoppingBag, CircleUserRound, Search, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

export function Header() {
  const { user, isAdmin } = useAuth();
  const { count, openCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Only sync URL while on home — avoids unmount/focus loss when typing from other routes
  useEffect(() => {
    if (location.pathname !== "/") return;
    const t = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (query === current) return;
      const params = new URLSearchParams(searchParams);
      if (query) params.set("q", query);
      else params.delete("q");
      const qs = params.toString();
      navigate(`/${qs ? `?${qs}` : ""}`, { replace: true });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, location.pathname]);

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const qs = params.toString();
    navigate(`/${qs ? `?${qs}` : ""}`);
    setMobileSearchOpen(false);
  };

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname]);

  const accountHref = isAdmin ? "/admin" : user ? "/minha-conta" : "/login";

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-3">
              <button
                aria-label="Menu"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <Link to="/" className="flex items-center gap-2 group cursor-pointer">
                <div className="overflow-hidden rounded-full h-9 w-9 md:h-10 md:w-10 border-2 border-primary/10 group-hover:border-primary/30 transition-colors bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-extrabold text-sm">G</span>
                </div>
                <span className="font-display font-bold text-xl tracking-tight text-primary hidden sm:block">
                  GIMPORTS
                </span>
              </Link>
            </div>

            <form onSubmit={submitSearch} className="relative flex-1 max-w-md mx-8 hidden md:block">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar produtos..."
                  className="w-full h-11 pl-10 pr-4 rounded-full bg-muted border-2 border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm"
                />
              </div>
            </form>

            <div className="flex items-center gap-2">
              <Link
                to={accountHref}
                className="hidden md:inline-flex items-center gap-2 h-10 md:h-11 px-3 md:px-4 rounded-full border border-primary/20 hover:border-primary text-primary font-semibold text-sm transition-colors"
              >
                <CircleUserRound className="w-5 h-5" />
                Minha Conta
              </Link>

              <button
                aria-label="Buscar"
                onClick={() => setMobileSearchOpen((v) => !v)}
                className="md:hidden p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                onClick={openCart}
                className="inline-flex items-center justify-center transition-all border-2 text-primary hover:bg-primary/5 font-medium relative rounded-full h-10 md:h-11 px-3 md:px-4 border-primary/20 hover:border-primary"
                aria-label="Abrir carrinho"
              >
                <ShoppingBag className="w-5 h-5 md:mr-2 text-primary" />
                <span className="font-semibold text-primary hidden md:inline">Carrinho</span>
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Mobile expanding search */}
          {mobileSearchOpen && (
            <form onSubmit={submitSearch} className="md:hidden pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar produtos..."
                  className="w-full h-11 pl-10 pr-4 rounded-full bg-muted border-2 border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm"
                />
              </div>
            </form>
          )}
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[85%] max-w-xs bg-background shadow-2xl flex flex-col animate-in slide-in-from-left">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <Link to="/" className="flex items-center gap-2">
                <div className="rounded-full h-9 w-9 bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-extrabold text-sm">G</span>
                </div>
                <span className="font-display font-bold text-lg text-primary">GIMPORTS</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-xl hover:bg-muted"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 flex flex-col gap-1 text-sm">
              <Link to="/" className="flex items-center gap-3 h-12 px-3 rounded-xl hover:bg-muted font-semibold">
                Catálogo
              </Link>
              <Link to={accountHref} className="flex items-center gap-3 h-12 px-3 rounded-xl hover:bg-muted font-semibold">
                <CircleUserRound className="w-5 h-5" />
                {user ? (isAdmin ? "Painel Admin" : "Minha Conta") : "Entrar / Cadastrar"}
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openCart();
                }}
                className="flex items-center gap-3 h-12 px-3 rounded-xl hover:bg-muted font-semibold text-left"
              >
                <ShoppingBag className="w-5 h-5" />
                Carrinho
                {count > 0 && (
                  <span className="ml-auto text-xs font-bold bg-secondary text-white px-2 py-0.5 rounded-full">{count}</span>
                )}
              </button>
              <Link to="/sobre" className="flex items-center gap-3 h-12 px-3 rounded-xl hover:bg-muted font-semibold">
                Sobre
              </Link>
            </nav>
            <div className="p-4 border-t border-border">
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center h-11 leading-[44px] rounded-full bg-[#25D366] text-white font-semibold text-sm"
              >
                Suporte WhatsApp
              </a>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
