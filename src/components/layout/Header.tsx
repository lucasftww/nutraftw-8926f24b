import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, X, ShoppingCart, MessageCircle, User, Heart, Info, LayoutGrid, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { prefetchMyAccount } from "@/App";
import logoRV from "@/assets/logo-rv.webp";
import logoRoyalVittaText from "@/assets/logo-royalvitta-text.webp";

/**
 * Header global da loja — versão redesenhada do zero.
 *
 * Estrutura:
 *  - Barra fixa no topo (sticky), 64px mobile / 80px desktop.
 *  - Esquerda: botão menu (mobile) + logomarca.
 *  - Direita: WhatsApp (desktop), Conta, Carrinho.
 *  - Drawer mobile: navegação + CTA WhatsApp no rodapé.
 *
 * Mantém TODA a funcionalidade da versão anterior:
 *  - Prefetch do chunk MyAccount em hover/touch/focus.
 *  - Indicador verde quando logado.
 *  - Badge de contagem no carrinho.
 *  - Trava de scroll + focus trap no drawer mobile.
 *  - Fecha drawer ao trocar de rota.
 *  - Sanitiza número do WhatsApp (apenas dígitos).
 */
export function Header({ isCheckout = false }: { isCheckout?: boolean }) {
  const { user } = useAuth();
  const { count, openCart } = useCart();
  const location = useLocation();
  const settings = useSiteSettings();

  const wa = (settings.whatsapp_number || "5511999999999").replace(/\D/g, "");
  const waMsg = encodeURIComponent(settings.whatsapp_message || "");
  const waHref = `https://wa.me/${wa}${waMsg ? `?text=${waMsg}` : ""}`;

  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // Fecha o menu ao navegar.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Trava o scroll e prende o foco enquanto o drawer está aberto.
  useBodyScrollLock(menuOpen);
  const drawerRef = useFocusTrap<HTMLElement>(menuOpen, closeMenu);

  const accountHref = user ? "/minha-conta" : "/login";
  const accountLabel = user ? "Minha conta" : "Entrar";
  const prefetchAccount = () => { prefetchMyAccount().catch(() => {}); };

  return (
    <>
      <header
        className="sticky top-0 inset-x-0 z-40 w-full border-b border-border/50 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 shadow-sm"
        role="banner"
        // Respeita safe-area do iOS (notch + barra de status em PWA standalone).
        // Sem isso, conteúdo do header ficava coberto no iPhone com notch.
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          {/* h-14 mobile (56px): atende WCAG tap target 44x44 com folga e
              dá branding adequado ao logo. h-16 desktop (64px) para presença. */}
          <div className="flex h-14 md:h-16 items-center justify-between gap-3">
            {/* Esquerda: menu (mobile) + logo */}
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Abrir menu"
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-primary/5 active:bg-primary/10 active:scale-95 transition-all"
              >
                <Menu className="h-5 w-5" strokeWidth={1.75} />
              </button>

              <Link
                to="/"
                aria-label="Royal Vitta — página inicial"
                className="group inline-flex items-center min-w-0"
              >
                {/* width/height refletem aspecto real renderizado para evitar
                    CLS — antes 80x80 reservava 1:1 mas o CSS forçava h-7
                    causando "esmagamento" e shift de layout. */}
                <img
                  src={logoRV}
                  alt="Royal Vitta"
                  width={104}
                  height={32}
                  decoding="async"
                  {...({ fetchpriority: "high" } as Record<string, string>)}
                  className="h-7 sm:h-8 md:h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </Link>
            </div>

            {isCheckout && (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-primary" strokeWidth={2.5} />
                </div>
                <span className="text-sm font-bold tracking-tight uppercase">Checkout Seguro</span>
              </div>
            )}

            {/* Direita: ações — OCULTAS no checkout para focar na conversão */}
            {!isCheckout && (
              <nav className="flex items-center gap-0.5 md:gap-1" aria-label="Ações da conta">
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                aria-label="Suporte WhatsApp"
                title="Suporte WhatsApp"
                className="hidden md:inline-flex h-11 w-11 items-center justify-center rounded-full text-whatsapp hover:bg-whatsapp/10 transition-colors"
              >
                <MessageCircle className="h-5 w-5" strokeWidth={1.75} />
              </a>

              <Link
                to={accountHref}
                aria-label={user ? `${accountLabel} (logado)` : accountLabel}
                title={accountLabel}
                onMouseEnter={prefetchAccount}
                onTouchStart={prefetchAccount}
                onFocus={prefetchAccount}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-primary/5 transition-colors"
              >
                <User
                  className="h-[22px] w-[22px]"
                  strokeWidth={user ? 0 : 1.6}
                  fill={user ? "currentColor" : "none"}
                />
                {user && (
                  <span
                    aria-hidden
                    className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-success ring-2 ring-background"
                  />
                )}
              </Link>

              <button
                type="button"
                onClick={openCart}
                aria-label={`Abrir carrinho${count > 0 ? ` (${count} ${count === 1 ? "item" : "itens"})` : ""}`}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-primary/5 transition-colors"
              >
                <ShoppingCart className="h-[22px] w-[22px]" strokeWidth={1.6} />
                {count > 0 && (
                  // key={count} re-monta o badge em cada mudança, animando
                  // o zoom-in — micro-recompensa visual ao adicionar produto.
                  <span
                    key={count}
                    className="absolute -top-0.5 -right-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold text-secondary-foreground ring-2 ring-background shadow-sm tabular-nums animate-in zoom-in-50 duration-300"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
              </nav>
            )}
          </div>
        </div>
      </header>

      {/* Drawer mobile — slide DA ESQUERDA (padrão BR: ML, Magalu, Shopee).
          Antes vinha de cima cobrindo o header — UX invertida e
          conflitante com a barra de status iOS. */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <div
            className="absolute inset-0 bg-foreground/55 backdrop-blur-sm animate-fade-in"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <aside
            id="mobile-menu"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-[85%] max-w-[360px] flex flex-col bg-background shadow-2xl outline-none animate-in slide-in-from-left duration-300 focus-visible:ring-2 focus-visible:ring-primary/40 overscroll-contain"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            {/* Cabeçalho do drawer */}
            <div className="border-b border-border/50">
              <div className="flex h-14 items-center justify-between px-4">
                <Link
                  to="/"
                  onClick={closeMenu}
                  className="inline-flex items-center min-w-0"
                  aria-label="Royal Vitta — página inicial"
                >
                  <img
                    src={logoRoyalVittaText}
                    alt="Royal Vitta"
                    width={240}
                    height={48}
                    decoding="async"
                    className="h-6 w-auto object-contain"
                  />
                </Link>
                <button
                  type="button"
                  onClick={closeMenu}
                  aria-label="Fechar menu"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-primary/5 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Navegação */}
            <nav
              className="flex-1 overflow-y-auto px-2 py-2 overscroll-contain"
              aria-label="Navegação principal"
            >
              <ul className="flex flex-col">
                <DrawerLink to="/" icon={LayoutGrid} label="Catálogo" />
                <DrawerLink to="/favoritos" icon={Heart} label="Favoritos" />
                <DrawerLink to={accountHref} icon={User} label={accountLabel} />
                <DrawerLink to="/sobre" icon={Info} label="Sobre" />
              </ul>
            </nav>

            {/* CTA WhatsApp */}
            <div
              className="border-t border-border/50 px-4 py-3"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
            >
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-whatsapp text-sm font-semibold text-whatsapp-foreground hover:bg-whatsapp-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp focus-visible:ring-offset-2"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2} />
                Suporte WhatsApp
              </a>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function DrawerLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Heart;
  label: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="grid h-12 grid-cols-[20px_1fr_16px] items-center gap-3 border-b border-border/40 text-[15px] font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Icon className="h-5 w-5 text-primary/60" strokeWidth={1.6} />
        <span>{label}</span>
        <ChevronRight className="h-4 w-4 justify-self-end text-primary/40" strokeWidth={1.6} />
      </Link>
    </li>
  );
}
