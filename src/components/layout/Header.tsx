import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, CircleUserRound, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import logoGimports from "@/assets/logo-gimports.png";

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
        <div className="w-full pl-2 pr-5 sm:pl-3 sm:pr-8 lg:pl-4 lg:pr-12">
          <div className="flex items-center justify-between h-16 md:h-20 gap-6">
            {/* Esquerda: menu mobile + logo */}
            <div className="flex items-center gap-3">
              <button
                aria-label="Menu"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              <Link to="/" className="flex items-center gap-2.5 group cursor-pointer">
                <img
                  src={logoGimports}
                  alt="GIMPORTS"
                  className="h-10 w-10 md:h-12 md:w-12 object-contain"
                />
                <span className="font-display font-bold text-lg md:text-xl tracking-tight text-primary hidden sm:block">
                  GIMPORTS
                </span>
              </Link>
            </div>

            {/* Direita: conta + carrinho */}
            <div className="flex items-center justify-end gap-3">
              <Link
                to={accountHref}
                className="hidden md:inline-flex items-center gap-2 h-11 px-5 rounded-full border border-primary/20 hover:border-primary text-primary font-semibold text-sm transition-colors"
              >
                <CircleUserRound className="w-5 h-5" />
                Minha Conta
              </Link>

              <button
                onClick={openCart}
                className="inline-flex items-center justify-center gap-2 transition-all text-primary hover:bg-primary/5 font-medium relative rounded-full h-10 md:h-11 px-3 md:px-4"
                aria-label="Abrir carrinho"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 text-primary"
                >
                  <path d="M3 4h2.2L7 15.5h11" />
                  <path d="M7 7h14l-1.6 7.2a1.5 1.5 0 0 1-1.5 1.3H7" />
                  <circle cx="9" cy="19" r="1.3" />
                  <circle cx="17" cy="19" r="1.3" />
                </svg>
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

      {/* Mobile drawer — alinhado ao header fixo */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute left-0 right-0 top-0 w-full bg-background shadow-2xl flex flex-col animate-in slide-in-from-top duration-300 max-h-[100dvh]">
            {/* Cabeçalho do drawer — idêntico ao header fixo */}
            <div className="sticky top-0 z-10 w-full glass border-b border-border/50 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 gap-4">
                  <Link to="/" className="flex items-center gap-2">
                    <div className="rounded-full h-9 w-9 bg-primary flex items-center justify-center shadow-sm">
                      <span className="text-primary-foreground font-extrabold text-sm">G</span>
                    </div>
                    <span className="font-display font-bold text-lg tracking-tight text-primary">GIMPORTS</span>
                  </Link>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 -mr-2 rounded-xl hover:bg-muted transition-colors"
                    aria-label="Fechar menu"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Conteúdo centralizado, com a mesma largura do header */}
            <div className="flex-1 overflow-y-auto">
              <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col items-center gap-2 text-base">
                <Link
                  to="/"
                  className="w-full max-w-sm flex items-center justify-center gap-2 h-12 px-4 rounded-full border border-primary/20 hover:border-primary text-primary font-semibold transition-colors"
                >
                  Catálogo
                </Link>
                <Link
                  to={accountHref}
                  className="w-full max-w-sm flex items-center justify-center gap-2 h-12 px-4 rounded-full border border-primary/20 hover:border-primary text-primary font-semibold transition-colors"
                >
                  <CircleUserRound className="w-5 h-5" />
                  {user ? (isAdmin ? "Painel Admin" : "Minha Conta") : "Entrar / Cadastrar"}
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openCart();
                  }}
                  className="w-full max-w-sm flex items-center justify-center gap-2 h-12 px-4 rounded-full border border-primary/20 hover:border-primary text-primary font-semibold transition-colors relative"
                >
                  <span className="text-lg leading-none" aria-hidden>🛒</span>
                  Carrinho
                  {count > 0 && (
                    <span className="absolute right-4 text-xs font-bold bg-secondary text-white px-2 py-0.5 rounded-full">{count}</span>
                  )}
                </button>
              </nav>
            </div>

            <div className="border-t border-border/50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-center">
                <a
                  href={`https://wa.me/${wa}${waMsg ? `?text=${waMsg}` : ""}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full max-w-sm text-center h-12 leading-[48px] rounded-full bg-[#25D366] text-white font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity"
                >
                  Suporte WhatsApp
                </a>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
