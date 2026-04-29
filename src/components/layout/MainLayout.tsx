import { Header } from "@/components/layout/Header";
import { ProductFooter } from "@/components/layout/ProductFooter";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Outlet } from "react-router-dom";
import { CurrentProductProvider } from "@/contexts/CurrentProductContext";
import { PerfOverlay } from "@/components/debug/PerfOverlay";

export function MainLayout() {
  return (
    <CurrentProductProvider>
      <div className="min-h-screen flex flex-col overflow-x-hidden bg-background pt-12 md:pt-14 [&_:target]:scroll-mt-16 md:[&_:target]:scroll-mt-20">
        <Header />
        <main className="flex-1 flex flex-col">
          <Outlet />
        </main>
        {/* Footer padronizado em todas as páginas (Home, Catálogo, Produto, etc.) */}
        <ProductFooter />
        <CartDrawer />
        <PerfOverlay />
      </div>
    </CurrentProductProvider>
  );
}
