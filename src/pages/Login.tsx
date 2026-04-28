import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const next = params.get("next") || "/minha-conta";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo!");
        const uid = signIn.user?.id;
        if (uid) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", uid);
          const isAdmin = roles?.some((r: any) => r.role === "admin");
          nav(isAdmin ? "/admin" : next, { replace: true });
        } else {
          nav(next, { replace: true });
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail se a confirmação estiver ativa.");
        nav(next, { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro na autenticação");
    } finally {
      setLoading(false);
    }
  }

  async function loginGoogle() {
    const target = next.startsWith("/") ? next : "/";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${target}` },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="container py-12 md:py-20 max-w-md">
      <div className="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8">
        <h1 className="font-display text-3xl font-extrabold text-primary text-center mb-2">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-6">
          {mode === "login" ? "Acesse sua conta GIMPORTS" : "Cadastre-se gratuitamente"}
        </p>

        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-full mb-6">
          <button
            onClick={() => setMode("login")}
            className={`h-9 rounded-full text-sm font-semibold transition-all ${
              mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => setMode("register")}
            className={`h-9 rounded-full text-sm font-semibold transition-all ${
              mode === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Cadastrar
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {mode === "register" && (
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
            )}
          </div>
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
          </div>
        </div>

        <Button onClick={loginGoogle} variant="outline" className="w-full" size="lg">
          Entrar com Google
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/" className="hover:text-primary">← Voltar ao catálogo</Link>
        </p>
      </div>
    </div>
  );
}
