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
        {/* Barra slim acima do header — escondida no checkout para foco.
            Nota: o strip de propostas de valor (ValuePropsBar) é renderizado
            dentro da página Catalog (mais perto da grade), não aqui — assim
            ele não conflita com a search bar `fixed top-14` que existe
            apenas naquela rota. */}
        {!isCheckout && <AnnouncementBar />}
        <Header isCheckout={isCheckout} />
        <main className="flex-1">
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
