import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Shield, ShieldOff, Loader2, Download, Phone, Mail, MapPin, ShoppingBag } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { logAdminAction } from "@/lib/auditLog";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { downloadCsv } from "@/lib/exportCsv";

interface UserRow {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  is_admin: boolean;
  orders_count: number;
  ltv: number;
  last_order_at: string | null;
  phone: string | null;
  cpf: string | null;
  city: string | null;
  state: string | null;
}

/**
 * Gestão de usuários e papéis (admin/customer).
 * Lista perfis (visível para admin via RLS), cruza com user_roles para
 * mostrar quem é admin, e permite promover/rebaixar.
 */
export function AdminUsers() {
  const { user: me } = useAuth();
  const [items, setItems] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<AdminErrorInfo | null>(null);
  const { confirm } = useConfirm();

  async function load() {
    setLoading(true);
    setError(null);
    // Bug fix: sem .range/.limit explícito, o Supabase corta em 1000 linhas
    // silenciosamente. Em loja com volume, isso quebra LTV e contagem de
    // pedidos. Aumentamos para 5000 (suficiente para 99% dos casos) e
    // alertamos se for atingido — sinal de que precisamos paginar.
    const ORDERS_LIMIT = 5000;
    const [profilesRes, rolesRes, ordersRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, email, full_name, created_at, phone, cpf, address_city, address_state")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      supabase
        .from("orders")
        .select("user_id, total, status, created_at")
        .in("status", ["paid", "processing", "shipped", "delivered"])
        .order("created_at", { ascending: false })
        .limit(ORDERS_LIMIT),
    ]);
    if (profilesRes.error) {
      const info = logSupabaseError("Carregar usuários", profilesRes.error, { table: "profiles" });
      setError(info);
      toast.error(`Usuários: ${info.message}`);
      setLoading(false);
      return;
    }
    if (rolesRes.error) {
      const info = logSupabaseError("Carregar papéis", rolesRes.error, { table: "user_roles" });
      setError(info);
      toast.error(`Papéis: ${info.message}`);
      setLoading(false);
      return;
    }
    if ((ordersRes.data?.length ?? 0) === ORDERS_LIMIT) {
      // Avisa em console — usuário admin saberá que números podem subestimar.
      console.warn(
        `[AdminUsers] LTV calculado sobre os ${ORDERS_LIMIT} pedidos mais recentes. ` +
        "Considere implementar paginação/agregação server-side.",
      );
    }
    const adminIds = new Set((rolesRes.data || []).map((r: any) => r.user_id));
    const stats = new Map<string, { count: number; ltv: number; last: string | null }>();
    for (const o of ((ordersRes.data as any[]) || [])) {
      const cur = stats.get(o.user_id) || { count: 0, ltv: 0, last: null };
      cur.count += 1;
      cur.ltv += Number(o.total || 0);
      if (!cur.last || new Date(o.created_at) > new Date(cur.last)) cur.last = o.created_at;
      stats.set(o.user_id, cur);
    }
    setItems(
      ((profilesRes.data as any[]) || []).map((p) => {
        const s = stats.get(p.user_id);
        return {
          user_id: p.user_id,
          email: p.email,
          full_name: p.full_name,
          created_at: p.created_at,
          phone: p.phone ?? null,
          cpf: p.cpf ?? null,
          city: p.address_city ?? null,
          state: p.address_state ?? null,
          is_admin: adminIds.has(p.user_id),
          orders_count: s?.count ?? 0,
          ltv: s?.ltv ?? 0,
          last_order_at: s?.last ?? null,
        };
      }),
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleAdmin(u: UserRow) {
    if (u.user_id === me?.id) {
      toast.error("Você não pode alterar seu próprio papel");
      return;
    }
    const action = u.is_admin ? "Remover privilégios de admin" : "Promover a admin";
    const ok = await confirm({
      title: `${action}?`,
      description: `Conta: ${u.email}`,
      variant: u.is_admin ? "destructive" : "default",
      confirmLabel: u.is_admin ? "Remover admin" : "Promover",
    });
    if (!ok) return;
    setBusy(u.user_id);
    if (u.is_admin) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", u.user_id)
        .eq("role", "admin");
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Admin removido");
        logAdminAction({
          action: "update",
          entity: "user_roles",
          entityId: u.user_id,
          summary: `Removido admin de ${u.email}`,
        });
        await load();
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: u.user_id, role: "admin" as any });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Promovido a admin");
        logAdminAction({
          action: "update",
          entity: "user_roles",
          entityId: u.user_id,
          summary: `${u.email} promovido a admin`,
        });
        await load();
      }
    }
    setBusy(null);
  }

  const filtered = items.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q) ||
      (u.city || "").toLowerCase().includes(q)
    );
  });

  const totals = useMemo(() => {
    const buyers = items.filter((u) => u.orders_count > 0);
    const ltvSum = buyers.reduce((s, u) => s + u.ltv, 0);
    return {
      buyers: buyers.length,
      avgLtv: buyers.length ? ltvSum / buyers.length : 0,
    };
  }, [items]);

  if (error) return <AdminErrorBanner error={error} onRetry={load} />;

  function exportCsv() {
    downloadCsv(
      `usuarios-${new Date().toISOString().slice(0, 10)}`,
      [
        { key: "full_name", label: "nome" },
        { key: "email", label: "email" },
        { key: "phone", label: "telefone" },
        { key: "city", label: "cidade" },
        { key: "state", label: "uf" },
        { key: "created_at", label: "cadastro" },
        { key: "is_admin", label: "admin" },
        { key: "orders_count", label: "pedidos" },
        { key: "ltv", label: "ltv" },
        { key: "last_order_at", label: "ultimo_pedido" },
      ],
      filtered as any,
    );
    toast.success(`${filtered.length} usuários exportados`);
  }

  return (
    <div className="space-y-4">
      {/* Stats compactos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard label="Usuários" value={items.length.toString()} />
        <StatCard label="Admins" value={items.filter((u) => u.is_admin).length.toString()} accent="primary" />
        <StatCard label="Compradores" value={totals.buyers.toString()} accent="success" />
        <StatCard label="LTV médio" value={formatBRL(totals.avgLtv)} />
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 items-stretch">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, e-mail, telefone ou cidade…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={loading || filtered.length === 0} className="shrink-0">
          <Download className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span>
        </Button>
      </div>

      {/* Mobile: cards */}
      <ul className="md:hidden space-y-2">
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="h-28 bg-muted/40 rounded-2xl animate-pulse" />
        ))}
        {!loading && filtered.map((u) => (
          <li key={u.user_id} className="bg-card rounded-2xl border border-border p-3">
            <div className="flex items-start gap-3">
              <Avatar name={u.full_name || u.email} admin={u.is_admin} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{u.full_name || "—"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                  </div>
                  {u.is_admin && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                      <Shield className="h-2.5 w-2.5" /> Admin
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                  {u.phone && (
                    <a href={whatsappLink(u.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-success hover:underline">
                      <Phone className="h-3 w-3" /> {formatPhone(u.phone)}
                    </a>
                  )}
                  {(u.city || u.state) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {[u.city, u.state].filter(Boolean).join("/")}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/60">
                  <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3" />
                    <span className="tabular-nums">{u.orders_count}</span>
                    <span className="mx-1">·</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatBRL(u.ltv)}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2"
                    disabled={busy === u.user_id || u.user_id === me?.id}
                    onClick={() => toggleAdmin(u)}
                  >
                    {busy === u.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : u.is_admin ? <><ShieldOff className="h-3 w-3" /> Remover</> : <><Shield className="h-3 w-3" /> Promover</>}
                  </Button>
                </div>
              </div>
            </div>
          </li>
        ))}
        {!loading && filtered.length === 0 && (
          <li className="bg-card rounded-2xl border border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </li>
        )}
      </ul>

      {/* Desktop: tabela */}
      <div className="hidden md:block bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 font-medium">Contato</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Localização</th>
                <th className="text-right px-4 py-3 font-medium">Pedidos</th>
                <th className="text-right px-4 py-3 font-medium">LTV</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Último</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando…</td></tr>
              )}
              {!loading && filtered.map((u) => (
                <tr key={u.user_id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={u.full_name || u.email} admin={u.is_admin} />
                      <div className="min-w-0">
                        <p className="font-medium truncate flex items-center gap-1.5">
                          {u.full_name || "—"}
                          {u.is_admin && <Shield className="h-3 w-3 text-primary shrink-0" />}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Cadastro {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${u.email}`} className="text-xs inline-flex items-center gap-1.5 text-foreground hover:text-primary truncate max-w-[200px]">
                      <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{u.email}</span>
                    </a>
                    {u.phone ? (
                      <a href={whatsappLink(u.phone)} target="_blank" rel="noreferrer" className="mt-0.5 text-xs inline-flex items-center gap-1.5 text-success hover:underline">
                        <Phone className="h-3 w-3" /> {formatPhone(u.phone)}
                      </a>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground/60">Sem telefone</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {(u.city || u.state) ? (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {[u.city, u.state].filter(Boolean).join("/")}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.orders_count}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatBRL(u.ltv)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {u.last_order_at ? new Date(u.last_order_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === u.user_id || u.user_id === me?.id}
                      onClick={() => toggleAdmin(u)}
                    >
                      {busy === u.user_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : u.is_admin ? (
                        <><ShieldOff className="h-3.5 w-3.5" /> Remover admin</>
                      ) : (
                        <><Shield className="h-3.5 w-3.5" /> Tornar admin</>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum usuário encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "primary" | "success" }) {
  const accentCls = accent === "primary" ? "text-primary" : accent === "success" ? "text-success" : "text-foreground";
  return (
    <div className="bg-card rounded-2xl border border-border p-3.5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-lg md:text-xl font-semibold tabular-nums ${accentCls}`}>{value}</p>
    </div>
  );
}

function Avatar({ name, admin }: { name: string; admin: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
  return (
    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold ring-1 ${admin ? "bg-primary/15 text-primary ring-primary/25" : "bg-muted text-foreground/80 ring-border"}`}>
      {initials}
    </div>
  );
}

function onlyDigits(s: string) { return s.replace(/\D/g, ""); }
function formatPhone(raw: string) {
  const d = onlyDigits(raw);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}
function whatsappLink(raw: string) {
  const d = onlyDigits(raw);
  const withCountry = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${withCountry}`;
}