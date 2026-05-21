import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getAffiliateRef, getAffiliateRefData, setAffiliateRef, clearAffiliateRef, readAttributionFromUrl } from "@/lib/affiliateRef";
import { friendlyAuthError } from "@/lib/friendlyError";
import { Users, Eye, EyeOff, Loader2, Lock, Zap, Package } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

export default function Login() {
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const initialEmail = (params.get("email") || "").trim();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  // Sanitiza o `next`: além de exigir "/" inicial sem "//" (open redirect),
  // restringimos a um whitelist de áreas de cliente. Antes, `next=/admin`
  // permitia jogar usuário comum em rota administrativa após login (a rota
  // bloquearia, mas é melhor não nem chegar lá). Rotas administrativas
  // sempre redirecionam para `/admin` no fluxo isAdmin abaixo.
  const rawNext = params.get("next") || params.get("redirect") || "/minha-conta";
  const ALLOWED_NEXT = /^\/(minha-conta|favoritos|carrinho|checkout|produto\/[\w-]+|catalogo|sobre|instalar)?(\/.*)?(\?.*)?$/;
  const next = /^\/(?!\/)/.test(rawNext) && ALLOWED_NEXT.test(rawNext) ? rawNext : "/minha-conta";

  // ?ref=CODIGO direto na URL do /login tem prioridade. Se vier, persiste já
  // (cobre o caso do usuário compartilhar /login?ref=XXX direto).
  // Persistir é EFEITO COLATERAL — não pode rodar durante render (StrictMode
  // duplica e quebra a janela de last-click).
  const [activeRef, setActiveRef] = useState<string | null>(() => getAffiliateRef());

  useSEO({
    title: mode === "register" ? "Criar conta — Royal Vitta" : "Entrar na sua conta — Royal Vitta",
    description:
      mode === "register"
        ? "Crie sua conta na Royal Vitta para acompanhar pedidos, salvar favoritos e participar do programa de afiliados."
        : "Acesse sua conta Royal Vitta para ver pedidos, endereços, favoritos e comissões de afiliação.",
    robots: "noindex,follow",
  });

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
    // Complexidade mínima no cadastro: ao menos uma letra e um número.
    // O `minLength={8}` no input deixava passar "12345678"/"password".
    if (mode === "register" && !/(?=.*[a-zA-Z])(?=.*\d).{8,}/.test(password)) {
      toast.error("Senha precisa ter ao menos 8 caracteres com letra e número");
      return;
    }
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
      toast.error(friendlyAuthError(err));
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
    if (error) toast.error(friendlyAuthError(error));
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
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-8 md:py-16 max-w-md animate-in fade-in duration-500">
      {/* Marca acima do card — identidade visual reforçada antes do form.
          Antes o login era anônimo: cliente que entrava pelo /login?next=...
          via um form genérico, sem reforço da marca Royal Vitta. */}
      <div className="text-center mb-5 md:mb-7">
        <div className="inline-flex h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-gradient-brand items-center justify-center shadow-lg shadow-primary/20 mb-3">
          <span className="font-display text-white text-xl md:text-2xl font-extrabold tracking-tight">
            RV
          </span>
        </div>
        <p className="text-2xs sm:text-xs font-bold uppercase tracking-[0.18em] text-secondary-text">
          Royal Vitta
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8">
        <h1 className="font-display text-2xl md:text-3xl font-extrabold text-foreground text-center mb-2 tracking-tight">
          {mode === "login" ? "Bem-vindo de volta" : "Criar sua conta"}
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-6">
          {mode === "login"
            ? "Acompanhe seus pedidos, favoritos e indicações."
            : "Cadastro grátis em 30 segundos. Sem complicação."}
        </p>

        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-full mb-6" role="group" aria-label="Modo de acesso">
          <button
            onClick={() => setMode("login")}
            aria-pressed={mode === "login"}
            className={`h-11 rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
              mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => setMode("register")}
            aria-pressed={mode === "register"}
            className={`h-11 rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
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
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                autoCapitalize="words"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            {/* Show/hide password — UX padrão em mobile (digitação correta
                em primeira tentativa reduz drasticamente abandono em login). */}
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode === "register" && (
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres com letra e número.</p>
            )}
          </div>
          {mode === "login" && (
            <div className="text-right">
              <button
                type="button"
                onClick={onForgotPassword}
                className="inline-flex items-center min-h-[44px] px-2 -mr-2 text-xs font-medium text-primary hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Aguarde…
              </>
            ) : mode === "login" ? "Entrar" : "Criar conta"}
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
          <Link
            to="/"
            className="inline-flex items-center min-h-[44px] px-3 hover:text-primary"
          >
            ← Voltar ao catálogo
          </Link>
        </p>
      </div>

      {/* Trust badges abaixo do card — reforça segurança no momento crítico.
          Usa ícones Lucide (não emojis) — consistência cross-platform. */}
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/40 border border-border/40 px-2 py-2.5 flex flex-col items-center">
          <Lock className="h-4 w-4 text-primary" strokeWidth={2.25} aria-hidden />
          <p className="text-2xs font-semibold text-muted-foreground mt-1.5 leading-tight">
            Dados<br />criptografados
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 border border-border/40 px-2 py-2.5 flex flex-col items-center">
          <Zap className="h-4 w-4 text-secondary" strokeWidth={2.25} aria-hidden />
          <p className="text-2xs font-semibold text-muted-foreground mt-1.5 leading-tight">
            Cadastro em<br />30 segundos
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 border border-border/40 px-2 py-2.5 flex flex-col items-center">
          <Package className="h-4 w-4 text-brand-cyan-text" strokeWidth={2.25} aria-hidden />
          <p className="text-2xs font-semibold text-muted-foreground mt-1.5 leading-tight">
            Acompanhe<br />pedidos
          </p>
        </div>
      </div>
    </div>
  );
}
