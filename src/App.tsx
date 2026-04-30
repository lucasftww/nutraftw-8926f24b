import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toaster } from "@/components/ui/sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/hooks/useAuth";
import { Suspense, lazy, type ReactNode } from "react";
import ScrollToTop from "@/components/ScrollToTop";
import Catalog from "@/pages/Catalog";
import ProductDetail from "@/pages/ProductDetail";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import About from "@/pages/About";
import ReferralCapture from "@/pages/ReferralCapture";
import {
  MyAccountSkeleton,
  CheckoutSkeleton,
  AdminSkeleton,
  WishlistSkeleton,
  GenericPageSkeleton,
} from "@/components/loading/RouteSkeletons";

// Code-split das rotas pesadas/raras: reduz drasticamente o JS inicial.
const MyAccount = lazy(() => import("@/pages/MyAccount"));
const Checkout = lazy(() => import("@/pages/Checkout"));
// Exposto para que componentes (Header) possam pré-carregar o chunk em hover/touch.
export const prefetchMyAccount = () => import("@/pages/MyAccount");
export const prefetchCheckout = () => import("@/pages/Checkout");
const Admin = lazy(() => import("@/pages/Admin"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminHealth = lazy(() => import("@/pages/AdminHealth"));
const Wishlist = lazy(() => import("@/pages/Wishlist"));
const Install = lazy(() => import("@/pages/Install"));

/**
 * Wrap por rota para que cada página lazy mostre um skeleton com a forma
 * final esperada — reduz percepção de lentidão e CLS no primeiro clique.
 */
function Lazy({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <AuthProvider>
              <ScrollToTop />
              <Routes>
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Catalog />} />
                  <Route path="/produto/:slug" element={<ProductDetail />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin/login" element={<Lazy fallback={<GenericPageSkeleton />}><AdminLogin /></Lazy>} />
                  <Route path="/checkout" element={<Lazy fallback={<CheckoutSkeleton />}><Checkout /></Lazy>} />
                  <Route path="/minha-conta" element={<RequireAuth fallback={<MyAccountSkeleton />}><Lazy fallback={<MyAccountSkeleton />}><MyAccount /></Lazy></RequireAuth>} />
                  <Route path="/favoritos" element={<Lazy fallback={<WishlistSkeleton />}><Wishlist /></Lazy>} />
                  <Route path="/instalar" element={<Lazy fallback={<GenericPageSkeleton />}><Install /></Lazy>} />
                  <Route path="/admin" element={<RequireAuth adminOnly fallback={<AdminSkeleton />}><Lazy fallback={<AdminSkeleton />}><Admin /></Lazy></RequireAuth>} />
                  <Route path="/admin/health" element={<RequireAuth adminOnly fallback={<AdminSkeleton />}><Lazy fallback={<AdminSkeleton />}><AdminHealth /></Lazy></RequireAuth>} />
                  <Route path="/sobre" element={<About />} />
                  <Route path="/r/:code" element={<ReferralCapture />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
