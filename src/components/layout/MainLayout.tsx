import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Outlet, useLocation } from "react-router-dom";

export function MainLayout() {
  const { pathname } = useLocation();
  // Home uses the VitrineHero as its own header — keep classic Header off there.
  const hideHeader = pathname === "/";
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-muted/30">
      {!hideHeader && <Header />}
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
