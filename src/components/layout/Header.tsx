import { Link, NavLink } from "react-router-dom";
import { ShoppingCart, CircleUserRound, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useState } from "react";

export function Header() {
  const { user, isAdmin } = useAuth();
  const { count, openCart } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  const accountHref = isAdmin ? "/admin" : user ? "/minha-conta" : "/login";
  const accountLabel = isAdmin ? "Admin" : user ? "Minha conta" : "Entrar";

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
      <div className="container flex items-center justify-between h-16 md:h-20 gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo-gimports.webp" alt="GIMPORTS" className="h-9 md:h-11 w-auto" />
          <span className="hidden sm:inline font-display text-xl md:text-2xl font-extrabold text-primary tracking-tight">
            GIMPORTS
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `text-sm font-semibold transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-primary"}`
            }
          >
            Catálogo
          </NavLink>
          <NavLink
            to="/sobre"
            className={({ isActive }) =>
              `text-sm font-semibold transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-primary"}`
            }
          >
            Sobre
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={openCart}
            className="relative inline-flex items-center justify-center h-10 w-10 md:h-11 md:w-11 rounded-full border border-primary/20 hover:border-primary text-primary transition-colors"
            aria-label="Abrir carrinho"
          >
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>

          <Link
            to={accountHref}
            className="hidden md:inline-flex items-center gap-2 h-11 px-4 rounded-full border border-primary/20 hover:border-primary text-primary font-semibold text-sm transition-colors"
          >
            <CircleUserRound className="h-5 w-5" />
            {accountLabel}
          </Link>

          <button
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-full border border-border text-foreground"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background animate-fade-in">
          <div className="container py-4 flex flex-col gap-3">
            <Link to="/" className="font-semibold text-foreground" onClick={() => setMobileOpen(false)}>
              Catálogo
            </Link>
            <Link to="/sobre" className="font-semibold text-foreground" onClick={() => setMobileOpen(false)}>
              Sobre
            </Link>
            <Link to={accountHref} className="font-semibold text-primary" onClick={() => setMobileOpen(false)}>
              {accountLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
