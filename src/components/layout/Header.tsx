import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import logoRoyalVita from "@/assets/logo-royalvita-horizontal.png";
import { prefetchMyAccount } from "@/App";

export function Header() {
  const { user, isAdmin } = useAuth();
  const { count, openCart } = useCart();
  const location = useLocation();
  const settings = useSiteSettings();
  // Normaliza: remove qualquer caractere não-numérico para garantir link wa.me válido
  // mesmo se admin salvar "+55 (11) 99999-9999".
  const wa = (settings.whatsapp_number || "5511999999999").replace(/\D/g, "");
  const waMsg = encodeURIComponent(settings.whatsapp_message || "");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll while drawer is open (compartilhado com CartDrawer via contador)
  useBodyScrollLock(mobileMenuOpen);

  // Focus trap + ESC + restauração de foco para o drawer mobile.
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const drawerRef = useFocusTrap<HTMLElement>(mobileMenuOpen, closeMobileMenu);

  const accountHref = user ? "/minha-conta" : "/login";
  const accountLabel = user ? "Minha conta" : "Entrar";
  // Pré-carrega o chunk de MyAccount no primeiro hover/touch para eliminar
  // o "Carregando…" no primeiro clique do ícone de perfil. Faz prefetch
  // mesmo sem user — o chunk MyAccount é pequeno e usuário pode logar em
  // seguida.
  const prefetchAccount = () => {
    prefetchMyAccount().catch(() => {});
  };

  return (
    <>
      <header className="sticky top-0 left-0 right-0 z-40 w-full glass border-b border-border/50 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="w-full pl-2 pr-3 sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-10">
          <div className="flex items-center justify-between h-16 md:h-20 gap-4">
            {/* Esquerda: menu mobile + logo */}
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <button
                aria-label="Menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden inline-flex items-center justify-center h-9 w-9 -ml-1 rounded-full text-primary/80 hover:text-primary hover:bg-primary/5 active:bg-primary/10 active:scale-95 data-[open=true]:bg-primary/10 data-[open=true]:text-primary transition-all duration-150"
                data-open={mobileMenuOpen}
              >
                {/* Hambúrguer minimalista — 3 traços finos com bom espaço */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="w-[18px] h-[18px]">
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </svg>
              </button>
              <Link to="/" className="flex items-center group cursor-pointer min-w-0" aria-label="Royal Vitta">
                {/* Lockup horizontal em todas as larguras — pré-carregado para evitar flash. */}
                <img
                  src={logoRoyalVita}
                  alt="Royal Vitta"
                  width={240}
                  height={64}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className="h-14 sm:h-12 md:h-14 lg:h-16 w-auto object-contain shrink-0"
                />
              </Link>
            </div>

            {/* Direita: conta + carrinho */}
            <div className="flex items-center justify-end gap-0.5 md:gap-1">
              {/* WhatsApp — só desktop (no mobile fica no rodapé do drawer) */}
              <a
                href={`https://wa.me/${wa}${waMsg ? `?text=${waMsg}` : ""}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Suporte WhatsApp"
                title="Suporte WhatsApp"
                className="hidden md:inline-flex items-center justify-center h-9 w-9 rounded-full text-whatsapp hover:bg-whatsapp/10 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-[20px] h-[20px]">
                  <path d="M20.5 3.5A11 11 0 0 0 3.7 17.3L2.5 21.5l4.3-1.1a11 11 0 0 0 13.7-16.9Zm-8.6 16.4a9 9 0 0 1-4.6-1.3l-.3-.2-2.6.7.7-2.5-.2-.3a9 9 0 1 1 7 3.6Zm5-6.7c-.3-.1-1.6-.8-1.9-.9s-.4-.1-.6.1-.7.9-.9 1.1-.3.1-.6 0a7.4 7.4 0 0 1-3.7-3.2c-.3-.5.3-.4.7-1.4.1-.2 0-.3 0-.5s-.6-1.5-.9-2-.5-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-1 2.3c0 1.4 1 2.7 1.2 2.9s2.1 3.2 5.1 4.4a16 16 0 0 0 1.7.6 4 4 0 0 0 1.9.1c.6-.1 1.6-.7 1.9-1.4s.3-1.2.2-1.4-.2-.2-.5-.3Z"/>
                </svg>
              </a>

              <Link
                to={accountHref}
                aria-label={accountLabel}
                title={accountLabel}
                onMouseEnter={prefetchAccount}
                onTouchStart={prefetchAccount}
                onFocus={prefetchAccount}
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
                  <span aria-hidden className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-success ring-2 ring-background" />
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
                  <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] px-1 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground ring-2 ring-background shadow-sm">
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
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <div
            className="absolute inset-0 bg-foreground/40 animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            tabIndex={-1}
            className="absolute left-0 right-0 top-0 w-full bg-background shadow-2xl flex flex-col animate-in slide-in-from-top duration-300 max-h-[100dvh] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {/* Cabeçalho — mesmas medidas, padding e tipografia do header fixo */}
            <div className="w-full glass border-b border-border/50 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
              <div className="w-full pl-2 pr-3 sm:pl-3 sm:pr-6">
                <div className="flex items-center justify-between h-16 gap-4">
                  {/*
                    Marca apenas visual (não-clicável) — evita duplicar o
                    destino "/" que já é coberto pelo item "Catálogo" abaixo.
                  */}
                  <div className="flex items-center min-w-0" aria-hidden="true">
                    <img
                      src={logoRoyalVita}
                      alt="Royal Vitta"
                      width={200}
                      height={48}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      className="h-16 w-auto object-contain shrink-0"
                    />
                  </div>
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

            {/* Navegação enxuta — Catálogo, Sobre e Minha conta (se logado) */}
            <nav className="flex flex-col pl-3 pr-3 sm:pl-4 sm:pr-6">
              <Link
                to="/"
                className="grid grid-cols-[20px_1fr_16px] items-center gap-3 h-12 text-[15px] font-semibold text-primary hover:bg-primary/5 transition-colors border-b border-border/50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-primary/60">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 9h18" />
                </svg>
                <span>Catálogo</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary/40 justify-self-end">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
              <Link
                to="/sobre"
                className="grid grid-cols-[20px_1fr_16px] items-center gap-3 h-12 text-[15px] font-semibold text-primary hover:bg-primary/5 transition-colors border-b border-border/50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-primary/60">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8h.01" />
                  <path d="M11 12h1v4h1" />
                </svg>
                <span>Sobre</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary/40 justify-self-end">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
              <Link
                to="/favoritos"
                className="grid grid-cols-[20px_1fr_16px] items-center gap-3 h-12 text-[15px] font-semibold text-primary hover:bg-primary/5 transition-colors border-b border-border/50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-primary/60">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span>Favoritos</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-primary/40 justify-self-end">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
              {/*
                Conta NÃO é exibida aqui — o ícone de perfil no header (acima)
                já dá acesso a /minha-conta (ou /admin) em mobile e desktop.
                Manter só navegação de páginas no drawer evita duplicidade.
              */}
            </nav>

            {/* Rodapé — WhatsApp, mesmo padding lateral */}
            <div className="pl-2 pr-3 sm:pl-3 sm:pr-6 py-3">
              <a
                href={`https://wa.me/${wa}${waMsg ? `?text=${waMsg}` : ""}`}
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center h-11 leading-[44px] rounded-full bg-whatsapp text-whatsapp-foreground font-semibold text-sm hover:bg-whatsapp-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp focus-visible:ring-offset-2"
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
