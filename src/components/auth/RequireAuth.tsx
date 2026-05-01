import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({
  children,
  adminOnly = false,
  fallback,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  /** Skeleton mostrado enquanto a sessão (e role, se admin) carrega. */
  fallback?: ReactNode;
}) {
  const { user, loading, isAdmin, roleLoading } = useAuth();
  const location = useLocation();
  const loadingNode = fallback ?? (
    <div className="container py-20 text-center text-muted-foreground">Carregando…</div>
  );
  if (loading) return <>{loadingNode}</>;
  // Rotas admin sempre redirecionam para o login dedicado do painel.
  const loginPath = adminOnly ? "/admin/login" : "/login";
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${loginPath}?next=${next}`} replace />;
  }
  if (adminOnly) {
    // role pode demorar 1-2 frames para carregar (fetchRole assíncrono).
    // Bug fix: enquanto `roleLoading` for true, mostre o skeleton em vez de
    // redirecionar — caso contrário um admin legítimo pode ser jogado em
    // /admin/login no primeiro render após login, antes do role chegar.
    if (roleLoading) return <>{loadingNode}</>;
    if (!isAdmin) {
      const next = encodeURIComponent(location.pathname + location.search);
      return <Navigate to={`/admin/login?next=${next}`} replace />;
    }
  }
  return <>{children}</>;
}
