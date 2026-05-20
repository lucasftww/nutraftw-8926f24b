import { useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { ProductFooter } from "@/components/layout/ProductFooter";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { WelcomeCouponPopup } from "@/components/layout/WelcomeCouponPopup";
import { ScrollToTopButton } from "@/components/layout/ScrollToTopButton";
import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
import { Outlet } from "react-router-dom";
import { CurrentProductProvider, useCurrentProduct } from "@/contexts/CurrentProductContext";
import { useCaptureAffiliateRef } from "@/hooks/useCaptureAffiliateRef";

/**
 * Z-index escala (documentar para evitar conflitos):
 *   announcement bar: estático (no fluxo)
 *   header sticky: z-40
 *   FAB whatsapp:    z-30
 *   drawer mobile:   z-50
 *   cart drawer:     z-50
 *   modais:          z-50
 *   toaster:         padrão sonner (top-center)
 */
export function MainLayout() {
  const location = useLocation();
  const isCheckout = location.pathname === "/checkout";

  // Captura ?ref=CODIGO em qualquer página (não só /r/:code).
  useCaptureAffiliateRef();
  return (
    <CurrentProductProvider>
      <div className="min-h-screen flex flex-col bg-background [&_:target]:scroll-mt-24 md:[&_:target]:scroll-mt-28">
        {/* Skip-to-content (a11y): invisível até receber foco via Tab.
            Permite teclado/leitor pular header/announcement bar e ir direto
            ao conteúdo principal — exigência WCAG 2.4.1 (Bypass Blocks). */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:inline-flex focus:items-center focus:h-11 focus:px-4 focus:rounded-full focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-semibold focus:shadow-lg focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Pular para o conteúdo
        </a>
        {/* Barra slim acima do header — escondida no checkout para foco. */}
        {!isCheckout && <AnnouncementBar />}
        <Header isCheckout={isCheckout} />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          <Outlet />
        </main>
        {/* Footer padronizado em todas as páginas (Home, Catálogo, Produto, etc.) */}
        <FooterWithStickyOffset />
        <CartDrawer />
        {/* WhatsApp flutuante — recupera o canal #1 de suporte BR. */}
        <FloatingWhatsApp />
        {/* Voltar ao topo — aparece após scrollar >600px, escondido próx. ao topo. */}
        {!isCheckout && <ScrollToTopButton />}
        {/* Popup de cupom (1x por visitante, delay 8s) — replace do banner
            fixo que ficava preso no topo. Converte sem ocupar viewport. */}
        {!isCheckout && <WelcomeCouponPopup />}
      </div>
    </CurrentProductProvider>
  );
}

/**
 * Em páginas de produto há uma barra de "Comprar agora" fixa no rodapé
 * (sm:hidden). Sem este offset, o footer ficaria coberto no mobile.
 */
function FooterWithStickyOffset() {
  const { current } = useCurrentProduct();
  return (
    <div className={current ? "pb-24 sm:pb-0" : undefined}>
      <ProductFooter />
    </div>
  );
}
