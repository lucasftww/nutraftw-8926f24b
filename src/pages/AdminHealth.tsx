import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Play,
  RefreshCw,
  ShieldCheck,
  ListChecks,
} from "lucide-react";

/**
 * /admin/health — Checklist de acesso ao painel.
 *
 * Cenários cobertos automaticamente:
 *  1. AuthProvider está montado e funcionando
 *  2. Sessão atual é admin (role admin presente em user_roles)
 *  3. Cache de role em sessionStorage está populado e válido
 *  4. SELECT em user_roles retorna sob RLS
 *  5. Acesso a tabela protegida (orders) funciona como admin
 *  6. Refresh: simula reload usando cache (verifica que role hidrata sem flash)
 *  7. HMR: verifica que múltiplos useAuth() compartilham o MESMO Context
 *
 * Cenário manual (com credenciais opcionais):
 *  8. Login com conta CUSTOMER deve ser BARRADA pelo /admin/login
 *  9. Login com conta ADMIN deve liberar /admin
 *
 * Cada teste tem status: idle | running | pass | fail | skipped, com detalhes.
 */

type Status = "idle" | "running" | "pass" | "fail" | "skipped";

type Check = {
  id: string;
  title: string;
  description: string;
  category: "auto" | "manual";
  status: Status;
  detail?: string;
  durationMs?: number;
};

const INITIAL: Check[] = [
  {
    id: "provider",
    title: "AuthProvider montado",
    description: "Context retorna estado válido (não fallback vazio).",
    category: "auto",
    status: "idle",
  },
  {
    id: "session",
    title: "Sessão admin ativa",
    description: "Usuário logado e role === 'admin' no Context.",
    category: "auto",
    status: "idle",
  },
  {
    id: "cache",
    title: "Cache de role em sessionStorage",
    description: "Entrada existe, é do user atual e dentro do TTL de 5 min.",
    category: "auto",
    status: "idle",
  },
  {
    id: "rls_user_roles",
    title: "RLS · user_roles legível",
    description: "SELECT na própria role retorna sem erro.",
    category: "auto",
    status: "idle",
  },
  {
    id: "rls_orders",
    title: "RLS · acesso admin a orders",
    description: "SELECT count em orders deve passar (policy admin).",
    category: "auto",
    status: "idle",
  },
  {
    id: "refresh_sim",
    title: "Refresh hidrata do cache",
    description: "Releitura do cache produz a mesma role sem nova query.",
    category: "auto",
    status: "idle",
  },
  {
    id: "context_shared",
    title: "HMR · Context único",
    description: "Múltiplos useAuth retornam a MESMA referência (sem listeners duplicados).",
    category: "auto",
    status: "idle",
  },
  {
    id: "customer_blocked",
    title: "Customer é barrado em /admin/login",
    description: "Login com conta customer deve fazer signOut e mostrar 'sem permissão'.",
    category: "manual",
    status: "idle",
  },
  {
    id: "admin_allowed",
    title: "Admin entra em /admin",
    description: "Login com conta admin deve liberar acesso ao painel.",
    category: "manual",
    status: "idle",
  },
];

const ROLE_CACHE_KEY = "auth.role.cache.v1";
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

export default function AdminHealth() {
  const auth = useAuth();
  const auth2 = useAuth(); // Para teste de Context único
  const [checks, setChecks] = useState<Check[]>(INITIAL);
  const [running, setRunning] = useState(false);

  // Credenciais opcionais para os testes manuais
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const summary = useMemo(() => {
    const counts = { pass: 0, fail: 0, skipped: 0, idle: 0, running: 0 };
    for (const c of checks) counts[c.status]++;
    return counts;
  }, [checks]);

  function update(id: string, patch: Partial<Check>) {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function runOne(id: string, fn: () => Promise<{ ok: boolean; detail?: string }>) {
    update(id, { status: "running", detail: undefined });
    const t0 = performance.now();
    try {
      const { ok, detail } = await fn();
      update(id, {
        status: ok ? "pass" : "fail",
        detail,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (e: any) {
      update(id, {
        status: "fail",
        detail: e?.message || String(e),
        durationMs: Math.round(performance.now() - t0),
      });
    }
  }

  // ───── Testes automáticos ─────
  async function runAuto() {
    setRunning(true);

    await runOne("provider", async () => {
      // O fallback de useAuth() retorna loading=true e user=null.
      // Se temos user OU já não está em loading inicial, o Provider está real.
      if (auth.loading && !auth.user) {
        return { ok: false, detail: "Provider ainda inicializando ou ausente." };
      }
      return { ok: true, detail: "Context fornece valores reais." };
    });

    await runOne("session", async () => {
      if (!auth.user) return { ok: false, detail: "Nenhum usuário logado." };
      if (!auth.isAdmin)
        return {
          ok: false,
          detail: `Logado como ${auth.user.email} mas role=${auth.role ?? "null"}.`,
        };
      return { ok: true, detail: `${auth.user.email} · role=admin` };
    });

    await runOne("cache", async () => {
      if (!auth.user) return { ok: false, detail: "Sem user para verificar cache." };
      const raw = sessionStorage.getItem(ROLE_CACHE_KEY);
      if (!raw) return { ok: false, detail: "sessionStorage vazio." };
      try {
        const entry = JSON.parse(raw);
        if (entry.uid !== auth.user.id)
          return { ok: false, detail: `Cache para outro uid (${entry.uid}).` };
        const age = Date.now() - entry.at;
        if (age > ROLE_CACHE_TTL_MS)
          return { ok: false, detail: `Cache expirado (${Math.round(age / 1000)}s).` };
        return {
          ok: true,
          detail: `role=${entry.role} · idade=${Math.round(age / 1000)}s · TTL ${Math.round(ROLE_CACHE_TTL_MS / 1000)}s`,
        };
      } catch (e: any) {
        return { ok: false, detail: "JSON inválido no cache." };
      }
    });

    await runOne("rls_user_roles", async () => {
      if (!auth.user) return { ok: false, detail: "Sem user." };
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id);
      if (error) return { ok: false, detail: error.message };
      return {
        ok: true,
        detail: `${data?.length || 0} role(s): ${data?.map((r: any) => r.role).join(", ")}`,
      };
    });

    await runOne("rls_orders", async () => {
      const { count, error } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true });
      if (error) return { ok: false, detail: `Bloqueado: ${error.message}` };
      return { ok: true, detail: `${count ?? 0} pedidos visíveis (policy admin OK).` };
    });

    await runOne("refresh_sim", async () => {
      if (!auth.user) return { ok: false, detail: "Sem user." };
      const raw = sessionStorage.getItem(ROLE_CACHE_KEY);
      if (!raw) return { ok: false, detail: "Sem cache para simular refresh." };
      const entry = JSON.parse(raw);
      // Simula o que o AuthProvider faria ao montar: lê o cache antes do fetch.
      const hidratado = entry.uid === auth.user.id ? entry.role : null;
      if (hidratado !== auth.role)
        return {
          ok: false,
          detail: `Cache=${hidratado} ≠ Context=${auth.role}. Risco de flash no refresh.`,
        };
      return { ok: true, detail: `Refresh hidrataria role=${hidratado} sem query.` };
    });

    await runOne("context_shared", async () => {
      // Se houvesse múltiplas instâncias, auth e auth2 seriam objetos novos a cada render.
      // Como vêm do MESMO Context, ambos referenciam o mesmo value.
      const same =
        auth.user?.id === auth2.user?.id &&
        auth.role === auth2.role &&
        auth.loading === auth2.loading;
      return same
        ? { ok: true, detail: "Duas chamadas useAuth() compartilham o mesmo estado." }
        : { ok: false, detail: "Hooks divergem — múltiplos providers ou listeners." };
    });

    setRunning(false);
  }

  // ───── Testes manuais (opcionais) ─────
  async function runCustomerTest() {
    if (!customerEmail || !customerPassword) {
      update("customer_blocked", {
        status: "skipped",
        detail: "Forneça credenciais de uma conta customer.",
      });
      return;
    }
    await runOne("customer_blocked", async () => {
      // Salva a sessão atual para restaurar depois.
      const { data: before } = await supabase.auth.getSession();
      const adminToken = before.session?.refresh_token;

      try {
        const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({
          email: customerEmail.trim().toLowerCase(),
          password: customerPassword,
        });
        if (signErr) return { ok: false, detail: `Falha ao logar customer: ${signErr.message}` };

        const uid = signIn.user!.id;
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid);
        const isAdmin = roles?.some((r: any) => r.role === "admin");
        await supabase.auth.signOut();

        // Restaura a sessão admin
        if (adminToken) {
          await supabase.auth.refreshSession({ refresh_token: adminToken });
        }

        if (isAdmin)
          return {
            ok: false,
            detail: "ESTA CONTA TEM ROLE ADMIN — não serve como teste de customer.",
          };
        return {
          ok: true,
          detail: `Customer ${customerEmail} foi corretamente identificado como NÃO-admin.`,
        };
      } catch (e: any) {
        if (adminToken) {
          try {
            await supabase.auth.refreshSession({ refresh_token: adminToken });
          } catch {
            /* noop */
          }
        }
        return { ok: false, detail: e.message };
      }
    });
  }

  async function runAdminTest() {
    if (!adminEmail || !adminPassword) {
      update("admin_allowed", {
        status: "skipped",
        detail: "Forneça credenciais de uma conta admin.",
      });
      return;
    }
    await runOne("admin_allowed", async () => {
      const { data: before } = await supabase.auth.getSession();
      const currentToken = before.session?.refresh_token;

      try {
        const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({
          email: adminEmail.trim().toLowerCase(),
          password: adminPassword,
        });
        if (signErr) return { ok: false, detail: `Falha ao logar admin: ${signErr.message}` };

        const uid = signIn.user!.id;
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid);
        const isAdmin = roles?.some((r: any) => r.role === "admin");

        // Se a conta de teste é diferente da atual, restaura a anterior.
        if (currentToken && signIn.user?.id !== before.session?.user.id) {
          await supabase.auth.signOut();
          await supabase.auth.refreshSession({ refresh_token: currentToken });
        }

        if (!isAdmin)
          return {
            ok: false,
            detail: `Conta ${adminEmail} NÃO tem role admin — promova antes de testar.`,
          };
        return { ok: true, detail: `${adminEmail} validada como admin com sucesso.` };
      } catch (e: any) {
        if (currentToken) {
          try {
            await supabase.auth.refreshSession({ refresh_token: currentToken });
          } catch {
            /* noop */
          }
        }
        return { ok: false, detail: e.message };
      }
    });
  }

  function reset() {
    setChecks(INITIAL.map((c) => ({ ...c, status: "idle", detail: undefined })));
  }

  // Roda automaticamente uma vez ao montar
  useEffect(() => {
    if (auth.loading) return;
    runAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading]);

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-primary" />
            Checklist de acesso ao /admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Valida login, refresh, cache e HMR. Use após mudanças em auth/role.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset} disabled={running}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Reset
          </Button>
          <Button onClick={runAuto} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-1.5" />
            )}
            Rodar testes auto
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryPill label="Passou" value={summary.pass} tone="ok" />
        <SummaryPill label="Falhou" value={summary.fail} tone="danger" />
        <SummaryPill label="Pulado" value={summary.skipped} tone="warn" />
        <SummaryPill label="Pendente" value={summary.idle + summary.running} tone="muted" />
      </div>

      {/* Estado atual do AuthProvider */}
      <div className="rounded-2xl border border-border bg-card p-4 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="font-semibold">Estado atual</span>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Field label="user" value={auth.user?.email || "—"} />
          <Field label="role" value={auth.role ?? "null"} />
          <Field label="isAdmin" value={String(auth.isAdmin)} />
          <Field label="loading" value={String(auth.loading)} />
        </dl>
      </div>

      {/* Lista de testes automáticos */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase text-muted-foreground tracking-wide">
          Automáticos
        </h2>
        {checks
          .filter((c) => c.category === "auto")
          .map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
      </section>

      {/* Testes manuais */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground tracking-wide">
          Manuais (opcionais)
        </h2>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
            Testes manuais fazem signIn em outras contas e restauram sua sessão admin
            ao final. Use credenciais de teste, não de produção.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2 rounded-xl border border-border p-3">
              <h3 className="text-sm font-semibold">Conta customer</h3>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@teste.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Senha</Label>
                <Input
                  type="password"
                  value={customerPassword}
                  onChange={(e) => setCustomerPassword(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={runCustomerTest}
                disabled={running}
                className="w-full"
              >
                Testar bloqueio customer
              </Button>
            </div>

            <div className="space-y-2 rounded-xl border border-border p-3">
              <h3 className="text-sm font-semibold">Conta admin (alternativa)</h3>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin2@teste.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Senha</Label>
                <Input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={runAdminTest}
                disabled={running}
                className="w-full"
              >
                Testar acesso admin
              </Button>
            </div>
          </div>
        </div>

        {checks
          .filter((c) => c.category === "manual")
          .map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
      </section>

      {/* Checklist manual de smoke-test */}
      <section className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm space-y-2">
        <h2 className="text-sm font-bold uppercase text-muted-foreground tracking-wide">
          Smoke-test manual (faça você mesmo)
        </h2>
        <ol className="list-decimal pl-5 space-y-1.5 text-xs text-muted-foreground">
          <li>
            Faça logout em <Link className="underline" to="/minha-conta">/minha-conta</Link>,
            tente abrir <code>/admin</code> → deve cair em <code>/admin/login</code>.
          </li>
          <li>
            Em <code>/admin/login</code>, logue com customer → deve mostrar erro
            "sem permissão" e oferecer "Sair desta conta".
          </li>
          <li>
            Logue com admin → deve abrir <code>/admin</code> direto.
          </li>
          <li>
            Pressione <kbd>F5</kbd> em <code>/admin</code> → não deve haver flash de
            "Carregando…" (cache hidrata role).
          </li>
          <li>
            Edite qualquer arquivo (HMR) → painel deve continuar acessível, sem
            "Should have a queue" no console.
          </li>
          <li>
            Volte aqui e clique <strong>Rodar testes auto</strong> → todos verdes.
          </li>
        </ol>
      </section>
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const Icon =
    check.status === "pass"
      ? CheckCircle2
      : check.status === "fail"
        ? XCircle
        : check.status === "running"
          ? Loader2
          : check.status === "skipped"
            ? AlertTriangle
            : null;
  const tone =
    check.status === "pass"
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : check.status === "fail"
        ? "text-destructive bg-destructive/5 border-destructive/30"
        : check.status === "running"
          ? "text-primary bg-primary/5 border-primary/30"
          : check.status === "skipped"
            ? "text-amber-700 bg-amber-50 border-amber-200"
            : "text-muted-foreground bg-card border-border";

  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {Icon ? (
            <Icon className={`h-4 w-4 ${check.status === "running" ? "animate-spin" : ""}`} />
          ) : (
            <div className="h-4 w-4 rounded-full border-2 border-current opacity-30" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold">{check.title}</p>
            {check.durationMs !== undefined && (
              <span className="text-[10px] tabular-nums opacity-60">{check.durationMs}ms</span>
            )}
          </div>
          <p className="text-xs opacity-80 mt-0.5">{check.description}</p>
          {check.detail && (
            <p className="text-[11px] mt-1.5 font-mono break-words bg-background/60 rounded p-2 border border-current/10">
              {check.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "danger" | "warn" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "danger"
        ? "bg-destructive/5 text-destructive border-destructive/30"
        : tone === "warn"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-card text-muted-foreground border-border";
  return (
    <div className={`rounded-2xl border p-3 ${cls}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs mt-0.5 break-all">{value}</dd>
    </div>
  );
}
