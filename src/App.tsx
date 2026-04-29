import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toaster } from "@/components/ui/sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/hooks/useAuth";
import { Suspense, lazy } from "react";
import Catalog from "@/pages/Catalog";
import ProductDetail from "@/pages/ProductDetail";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import About from "@/pages/About";

// Code-split das rotas pesadas/raras: reduz drasticamente o JS inicial.
const MyAccount = lazy(() => import("@/pages/MyAccount"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminHealth = lazy(() => import("@/pages/AdminHealth"));

function RouteFallback() {
  return (
    <div className="container py-20 text-center text-sm text-muted-foreground">
      Carregando…
    </div>
  );
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
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Catalog />} />
                  <Route path="/produto/:slug" element={<ProductDetail />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/minha-conta" element={<RequireAuth><MyAccount /></RequireAuth>} />
                  <Route path="/admin" element={<RequireAuth adminOnly><Admin /></RequireAuth>} />
                  <Route path="/admin/health" element={<RequireAuth adminOnly><AdminHealth /></RequireAuth>} />
                  <Route path="/sobre" element={<About />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
