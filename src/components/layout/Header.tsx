import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import logoGimports from "@/assets/logo-gimports.svg";

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
  const accountLabel = user ? (isAdmin ? "Painel" : "Minha conta") : "Entrar";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 w-full glass border-b border-border/50 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="w-full pl-2 pr-3 sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-10">
          <div className="flex items-center justify-between h-12 md:h-14 gap-4">
            {/* Esquerda: menu mobile + logo */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <button
                aria-label="Menu"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden inline-flex items-center justify-center h-9 w-9 -ml-1 rounded-full hover:bg-muted transition-colors"
              >
                {/* Hambúrguer minimalista — 3 traços finos com bom espaço */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-5 h-5">
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </svg>
              </button>
              <Link to="/" className="flex items-center gap-2 group cursor-pointer min-w-0">
                <img
                  src={logoGimports}
                  alt="GIMPORTS"
                  className="h-7 w-7 md:h-8 md:w-8 object-contain shrink-0"
                />
                <span className="font-display font-semibold text-[15px] md:text-base tracking-tight text-primary hidden sm:block truncate">
                  GIMPORTS
                </span>
              </Link>
            </div>

            {/* Direita: conta + carrinho */}
            <div className="flex items-center justify-end gap-0.5 md:gap-1">
              <Link
                to={accountHref}
                aria-label={accountLabel}
                title={accountLabel}
                className="relative inline-flex items-center justify-center h-9 w-9 rounded-full text-primary hover:bg-primary/5 transition-colors"
              >
                {user ? (
                  // Bonequinho preenchido (logado)
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-[22px] h-[22px]">
                    <circle cx="12" cy="8" r="3.6" />
                    <path d="M4.5 19.2c.7-3.4 3.7-5.7 7.5-5.7s6.8 2.3 7.5 5.7c.1.6-.4 1.1-1 1.1H5.5c-.6 0-1.1-.5-1-1.1Z" />
                  </svg>
                ) : (
                  // Bonequinho outline (deslogado)
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
                    <circle cx="12" cy="8" r="3.6" />
                    <path d="M5 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5" />
                  </svg>
                )}
                {user && (
                  <span aria-hidden className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                )}
              </Link>

              <button
                onClick={openCart}
                className="inline-flex items-center justify-center transition-all text-primary hover:bg-primary/5 font-medium relative rounded-full h-9 w-9"
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
                  className="w-[22px] h-[22px] text-primary shrink-0"
                >
                  <path d="M3 4h2.2L7 15.5h11" />
                  <path d="M7 7h14l-1.6 7.2a1.5 1.5 0 0 1-1.5 1.3H7" />
                  <circle cx="9" cy="19" r="1.3" />
                  <circle cx="17" cy="19" r="1.3" />
                </svg>
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] px-1 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer — herda exatamente os estilos do navbar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute left-0 right-0 top-0 w-full bg-background shadow-2xl flex flex-col animate-in slide-in-from-top duration-300 max-h-[100dvh]">
            {/* Cabeçalho — mesmas medidas, padding e tipografia do header fixo */}
            <div className="w-full glass border-b border-border/50 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
              <div className="w-full pl-2 pr-3 sm:pl-3 sm:pr-6">
                <div className="flex items-center justify-between h-12 md:h-14 gap-4">
                  <Link to="/" className="flex items-center gap-2 group cursor-pointer min-w-0">
                    <img src={logoGimports} alt="GIMPORTS" className="h-7 w-7 md:h-8 md:w-8 object-contain shrink-0" />
                    <span className="font-display font-semibold text-[15px] md:text-base tracking-tight text-primary truncate">
                      GIMPORTS
                    </span>
                  </Link>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Fechar menu"
                    className="inline-flex items-center justify-center h-9 w-9 -mr-1 rounded-full text-primary hover:bg-primary/5 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-5 h-5">
                      <path d="M6 6l12 12" />
                      <path d="M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Navegação — mesma tipografia e divisores do header */}
            <nav className="flex flex-col pl-2 pr-3 sm:pl-3 sm:pr-6">
              <Link
                to="/"
                className="flex items-center justify-between h-12 text-[15px] font-semibold text-primary hover:bg-primary/5 transition-colors border-b border-border/50"
              >
                Catálogo
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary/60">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
              <Link
                to="/sobre"
                className="flex items-center justify-between h-12 text-[15px] font-semibold text-primary hover:bg-primary/5 transition-colors border-b border-border/50"
              >
                Sobre
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary/60">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
              {user && (
                <Link
                  to={accountHref}
                  className="flex items-center justify-between h-12 text-[15px] font-semibold text-primary hover:bg-primary/5 transition-colors border-b border-border/50"
                >
                  {isAdmin ? "Painel Admin" : "Minha conta"}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary/60">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              )}
            </nav>

            {/* Rodapé — WhatsApp, mesmo padding lateral */}
            <div className="pl-2 pr-3 sm:pl-3 sm:pr-6 py-3">
              <a
                href={`https://wa.me/${wa}${waMsg ? `?text=${waMsg}` : ""}`}
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center h-10 leading-[40px] rounded-full bg-[#25D366] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
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
