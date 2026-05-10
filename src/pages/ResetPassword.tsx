import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { friendlyAuthError } from "@/lib/friendlyError";

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
    if (password !== confirm) {
      toast.error("As senhas não conferem");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso!");
      nav("/minha-conta", { replace: true });
    } catch (err: any) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-12 md:py-20 max-w-md">
      <div className="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8">
        <h1 className="font-display text-3xl font-extrabold text-primary text-center mb-2">
          Redefinir senha
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-6">
          {ready ? "Escolha uma nova senha para sua conta" : "Validando link de recuperação…"}
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
            {loading ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/login" className="hover:text-primary">← Voltar ao login</Link>
        </p>
      </div>
    </div>
  );
}