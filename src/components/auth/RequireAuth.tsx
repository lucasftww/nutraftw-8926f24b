import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <div className="container py-20 text-center text-muted-foreground">Carregando…</div>;
  // Rotas admin sempre redirecionam para o login dedicado do painel.
  const loginPath = adminOnly ? "/admin/login" : "/login";
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${loginPath}?next=${next}`} replace />;
  }
  if (adminOnly && !isAdmin) {
    // Logado mas sem permissão → vai para o login admin que mostra o erro claro
    // e oferece logout, evitando o redirect silencioso para a home.
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}
