import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, CircleUserRound, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export function Header() {
  const { user, isAdmin } = useAuth();
  const { count, openCart } = useCart();
  const location = useLocation();
  const settings = useSiteSettings();
  const wa = settings.whatsapp_number || "5511999999999";
  const waMsg = encodeURIComponent(settings.whatsapp_message || "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  const accountHref = isAdmin ? "/admin" : user ? "/minha-conta" : "/login";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 w-full glass border-b border-border/50 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20 gap-4">
            {/* Esquerda: menu mobile + logo */}
            <div className="flex items-center gap-3">
              <button
                aria-label="Menu"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <Link to="/" className="flex items-center gap-2 group cursor-pointer">
                <div className="overflow-hidden rounded-full h-9 w-9 md:h-10 md:w-10 border-2 border-primary/10 group-hover:border-primary/30 transition-colors bg-primary flex items-center justify-center shadow-sm">
                  <span className="text-primary-foreground font-extrabold text-sm">G</span>
                </div>
                <span className="font-display font-bold text-lg md:text-xl tracking-tight text-primary hidden sm:block">
                  GIMPORTS
                </span>
              </Link>
            </div>

            {/* Direita: conta + carrinho */}
            <div className="flex items-center justify-end gap-2">
              <Link
                to={accountHref}
                className="hidden md:inline-flex items-center gap-2 h-11 px-4 rounded-full border border-primary/20 hover:border-primary text-primary font-semibold text-sm transition-colors"
              >
                <CircleUserRound className="w-5 h-5" />
                Minha Conta
              </Link>

              <button
                onClick={openCart}
                className="inline-flex items-center justify-center transition-all border-2 text-primary hover:bg-primary/5 font-medium relative rounded-full h-10 md:h-11 px-3 md:px-4 border-primary/20 hover:border-primary"
                aria-label="Abrir carrinho"
              >
                <span className="text-lg md:mr-2 leading-none" aria-hidden>🛒</span>
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
            </nav>
            <div className="p-4 border-t border-border">
              <a
                href={`https://wa.me/${wa}${waMsg ? `?text=${waMsg}` : ""}`}
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
