import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Loader2, AlertTriangle, LogOut } from "lucide-react";

/**
 * Tela de login dedicada ao painel administrativo (/admin).
 *
 * Diferente da /login do cliente, esta página:
 *  - Só libera acesso quando a role "admin" é CONFIRMADA no banco.
 *  - Se o usuário logado não for admin, faz signOut e mostra erro claro.
 *  - Redireciona automaticamente para /admin (ou ?next=) quando autenticado e admin.
 *  - Faz a verificação de role server-side via select em user_roles (RLS já restringe).
 */
export default function AdminLogin() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user, loading, isAdmin } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);

  // Sanitiza o `next` (apenas caminhos internos do admin).
  const rawNext = params.get("next") || "/admin";
  const next = /^\/admin(\/|$)/.test(rawNext) ? rawNext : "/admin";

  // Se logou em outra aba como cliente comum, avisa e oferece logout.
  useEffect(() => {
    if (!loading && user && !isAdmin && !denied) {
      setDenied(
        `A conta ${user.email ?? ""} não tem permissão de administrador.`,
      );
    }
  }, [loading, user, isAdmin, denied]);

  // Se já está logado E confirmado como admin → redireciona.
  // ⚠️ Esse early return DEVE vir DEPOIS de todos os hooks (Rules of Hooks),
  // senão React quebra com "rendered fewer hooks than expected" no momento
  // em que `isAdmin` vira true entre renders.
  if (!loading && user && isAdmin) {
    return <Navigate to={next} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDenied(null);
    setSubmitting(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data: signIn, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) throw error;
      const uid = signIn.user?.id;
      if (!uid) throw new Error("Sessão inválida");

      // Verificação de role server-side. RLS garante que só vemos roles do próprio user.
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (rolesErr) throw rolesErr;

      const ok = roles?.some((r: any) => r.role === "admin");
      if (!ok) {
        // Sem permissão: derruba a sessão imediatamente.
        await supabase.auth.signOut();
        setDenied(`A conta ${cleanEmail} não tem permissão de administrador.`);
        toast.error("Acesso negado", {
          description: "Esta conta não é administradora.",
        });
        return;
      }

      toast.success("Bem-vindo, admin!");
      nav(next, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Falha ao autenticar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setDenied(null);
    setEmail("");
    setPassword("");
  }

  return (
    <main className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Painel administrativo</h1>
            <p className="text-sm text-muted-foreground">
              Acesso restrito. Use suas credenciais de administrador.
            </p>
          </div>

          {denied && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="font-medium leading-snug">{denied}</p>
                {user && (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2 hover:no-underline"
                  >
                    <LogOut className="h-3 w-3" /> Sair desta conta
                  </button>
                )}
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">E-mail</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={submitting}
                placeholder="admin@exemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Senha</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={submitting}
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-full"
              disabled={submitting || loading}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Verificando…
                </>
              ) : (
                "Entrar no painel"
              )}
            </Button>
          </form>

          <p className="text-[11px] text-center text-muted-foreground">
            Ao entrar, sua role é validada no banco antes de liberar o acesso.
          </p>
        </div>
      </div>
    </main>
  );
}
