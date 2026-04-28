import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductFooter } from "@/components/layout/ProductFooter";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Outlet, useLocation } from "react-router-dom";

export function MainLayout() {
  const location = useLocation();
  const isProduct = location.pathname.startsWith("/produto/");
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-background pt-12 md:pt-14 [&_:target]:scroll-mt-16 md:[&_:target]:scroll-mt-20">
      <Header />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      {isProduct ? <ProductFooter /> : <Footer />}
      <CartDrawer />
    </div>
  );
}
