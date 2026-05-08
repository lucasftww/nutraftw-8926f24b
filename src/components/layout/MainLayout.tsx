import { useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { ProductFooter } from "@/components/layout/ProductFooter";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Outlet } from "react-router-dom";
import { CurrentProductProvider, useCurrentProduct } from "@/contexts/CurrentProductContext";
import { PerfOverlay } from "@/components/debug/PerfOverlay";
import { useCaptureAffiliateRef } from "@/hooks/useCaptureAffiliateRef";

export function MainLayout() {
  const location = useLocation();
  const isCheckout = location.pathname === "/checkout";

  // Captura ?ref=CODIGO em qualquer página (não só /r/:code).
  useCaptureAffiliateRef();
  return (
    <CurrentProductProvider>
      <div className="min-h-screen flex flex-col bg-background [&_:target]:scroll-mt-16 md:[&_:target]:scroll-mt-20">
        <Header isCheckout={isCheckout} />
        <main className="flex-1">
          <Outlet />
        </main>
        {/* Footer padronizado em todas as páginas (Home, Catálogo, Produto, etc.) */}
        <FooterWithStickyOffset />
        <CartDrawer />
        <PerfOverlay />
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
