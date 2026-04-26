import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ShoppingBag, CircleUserRound, Search, Menu } from "lucide-react";
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

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (query === current) return;
      const params = new URLSearchParams(searchParams);
      if (query) params.set("q", query);
      else params.delete("q");
      const qs = params.toString();
      navigate(`/${qs ? `?${qs}` : ""}`, { replace: location.pathname === "/" });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const accountHref = isAdmin ? "/admin" : user ? "/minha-conta" : "/login";

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center gap-3">
            <button
              aria-label="Menu"
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

          <div className="relative flex-1 max-w-md mx-8 hidden md:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full h-11 pl-10 pr-4 rounded-full bg-muted border-2 border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm"
              />
            </div>
          </div>

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
      </div>
    </header>
  );
}
