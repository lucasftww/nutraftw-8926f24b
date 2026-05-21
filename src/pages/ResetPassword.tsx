import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { friendlyAuthError } from "@/lib/friendlyError";
import { KeyRound, Loader2 } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    // Supabase coloca o token no hash (#access_token=...&type=recovery) e cria
    // uma sessão de recuperação automaticamente. Esperamos o evento.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Se já existe sessão de recovery (ex: refresh), libera o form.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Senha precisa ter no mínimo 8 caracteres");
      return;
    }
    // Complexidade mínima: ao menos uma letra e um dígito. Antes "12345678"
    // ou "password" passavam — fraco demais para uma loja com CPF/endereço.
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      toast.error("Use ao menos uma letra e um número na senha");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Se o token de recovery vazou (e-mail comprometido), o atacante teria
      // janela aberta nas outras sessões já autenticadas. Invalidar "others"
      // força re-login em outros dispositivos.
      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch {
        // não-bloqueante — se falhar, ainda assim a senha foi trocada
      }
      toast.success("Senha redefinida com sucesso!");
      nav("/minha-conta", { replace: true });
    } catch (err: any) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-8 md:py-16 max-w-md animate-in fade-in duration-500">
      {/* Hero — ícone de chave em gradient para reforçar contexto "secure" */}
      <div className="text-center mb-5 md:mb-7">
        <div className="inline-flex h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-gradient-brand items-center justify-center shadow-lg shadow-primary/20 mb-3">
          <KeyRound className="h-6 w-6 md:h-7 md:w-7 text-white" strokeWidth={2} />
        </div>
        <p className="text-2xs sm:text-xs font-bold uppercase tracking-[0.18em] text-secondary-text">
          Recuperação de senha
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8">
        <h1 className="font-display text-2xl md:text-3xl font-extrabold text-foreground text-center mb-2 tracking-tight">
          Redefinir senha
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-6 leading-relaxed">
          {ready ? (
            "Escolha uma nova senha. Outros dispositivos logados serão deslogados por segurança."
          ) : (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Validando link de recuperação…
            </span>
          )}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={!ready}
              autoComplete="new-password"
            />
            <p className="text-2xs text-muted-foreground">Mínimo 8 caracteres com letra e número.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              disabled={!ready}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={loading || !ready} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando…
              </>
            ) : "Salvar nova senha"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link
            to="/login"
            className="inline-flex items-center min-h-[44px] px-3 hover:text-primary"
          >
            ← Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}