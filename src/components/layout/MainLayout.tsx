import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductFooter } from "@/components/layout/ProductFooter";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Outlet, useLocation } from "react-router-dom";

export function MainLayout() {
  const location = useLocation();
  const isProduct = location.pathname.startsWith("/produto/");
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-background">
      <Header />
      {/* Spacer para compensar header fixo */}
      <div aria-hidden className="h-16 md:h-20" />
      <main className="flex-1">
        <Outlet />
      </main>
      {isProduct ? <ProductFooter /> : <Footer />}
      <CartDrawer />
    </div>
  );
}
