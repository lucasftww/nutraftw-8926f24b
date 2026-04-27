import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function RequireAuth({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <div className="container py-20 text-center text-muted-foreground">Carregando…</div>;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}
