import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getAffiliateRef, getAffiliateRefData, setAffiliateRef, clearAffiliateRef, readAttributionFromUrl } from "@/lib/affiliateRef";
import { Users } from "lucide-react";

export default function Login() {
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const initialEmail = (params.get("email") || "").trim();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  // Sanitiza o `next`: aceita SOMENTE caminhos internos (começam com "/" e
  // não com "//" para evitar protocol-relative URLs / open redirect).
  const rawNext = params.get("next") || params.get("redirect") || "/minha-conta";
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : "/minha-conta";

  // ?ref=CODIGO direto na URL do /login tem prioridade. Se vier, persiste já
  // (cobre o caso do usuário compartilhar /login?ref=XXX direto).
  // Persistir é EFEITO COLATERAL — não pode rodar durante render (StrictMode
  // duplica e quebra a janela de last-click).
  const [activeRef, setActiveRef] = useState<string | null>(() => getAffiliateRef());
  useEffect(() => {
    const r = params.get("ref");
    if (r) {
      const saved = setAffiliateRef(r, readAttributionFromUrl(params.toString()));
      if (saved) setActiveRef(saved);
    } else {
      setActiveRef(getAffiliateRef());
    }
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      if (mode === "login") {
        const { data: signIn, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        toast.success("Bem-vindo!");
        const uid = signIn.user?.id;
        if (uid) {
          const { data: roles, error: rolesErr } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", uid);
          if (rolesErr) console.error("[Login] roles fetch failed", rolesErr);
          const roleRows = (roles ?? []) as Array<{ role: string }>;
          const isAdmin = roleRows.some((r) => r.role === "admin");
          nav(isAdmin ? "/admin" : next, { replace: true });
        } else {
          nav(next, { replace: true });
        }
      } else {
        // Re-lê no momento do submit (pode ter sido atualizado por outra aba).
        const refData = getAffiliateRefData();
        const refCode = refData?.code ?? null;
        const { data: signUp, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        // Atribuição: grava o código no perfil do novo usuário e cria a indicação.
        const newUid = signUp.user?.id;
        if (newUid && refCode) {
          // 1) Resolve o afiliado dono do código ANTES de gravar — evita gravar
          //    códigos inválidos no perfil.
          const { data: aff } = await supabase
            .from("profiles")
            .select("user_id, affiliate_code")
            .eq("affiliate_code", refCode)
            .maybeSingle();

          if (aff?.user_id && aff.user_id !== newUid) {
            // 2) Política first-touch: se o perfil já tem uma indicação salva
            //    (ex.: o usuário já existia, criou conta anterior, ou outra
            //    aba/sessão gravou primeiro), NÃO sobrescreve. Mantém o
            //    primeiro afiliado que trouxe o usuário.
            const { data: existingProfile } = await supabase
              .from("profiles")
              .select("referred_by_code")
              .eq("user_id", newUid)
              .maybeSingle();

            const alreadyAttributed = !!existingProfile?.referred_by_code?.trim();

            if (!alreadyAttributed) {
              await supabase.from("profiles")
                .update({ referred_by_code: aff.affiliate_code })
                .eq("user_id", newUid);

              await supabase.from("affiliate_referrals").insert({
                affiliate_user_id: aff.user_id,
                referred_user_id: newUid,
                referred_email: cleanEmail,
                status: "inactive",
                utm_source: refData?.utm_source ?? null,
                utm_medium: refData?.utm_medium ?? null,
                utm_campaign: refData?.utm_campaign ?? null,
                utm_term: refData?.utm_term ?? null,
                utm_content: refData?.utm_content ?? null,
                landing_path: refData?.landing_path ?? null,
                referrer: refData?.referrer ?? null,
              });
            }
          }
          clearAffiliateRef();
        }
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
    const target = next; // já sanitizado acima
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${target}` },
    });
    if (error) toast.error(error.message);
  }

  async function onForgotPassword() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Digite seu e-mail acima primeiro");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviamos um link de recuperação para seu e-mail.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar e-mail de recuperação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-12 md:py-20 max-w-md">
      <div className="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8">
        <h1 className="font-display text-3xl font-extrabold text-primary text-center mb-2">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
         <p className="text-center text-sm text-muted-foreground mb-6">
           {mode === "login" ? "Acesse sua conta" : "Cadastre-se gratuitamente"}
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
          {mode === "register" && activeRef && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
              <Users className="h-4 w-4 shrink-0" />
              <span>
                Você foi indicado pelo código{" "}
                <span className="font-mono font-semibold">{activeRef}</span>
              </span>
            </div>
          )}
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
          {mode === "login" && (
            <div className="text-right">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs font-medium text-primary hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
          )}
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
