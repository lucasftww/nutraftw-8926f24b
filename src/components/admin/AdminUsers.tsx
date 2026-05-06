import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Shield, ShieldOff, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { logAdminAction } from "@/lib/auditLog";
import { AdminErrorBanner, type AdminErrorInfo, logSupabaseError } from "@/components/admin/AdminErrorBanner";
import { useConfirm } from "@/components/admin/ConfirmDialog";

interface UserRow {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  is_admin: boolean;
  orders_count: number;
  ltv: number;
  last_order_at: string | null;
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
        .select("user_id, email, full_name, created_at")
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
          ...p,
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
      (u.full_name || "").toLowerCase().includes(q)
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou e-mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground basis-full sm:basis-auto leading-relaxed">
          {items.length} {items.length === 1 ? "usuário" : "usuários"} ·{" "}
          {items.filter((u) => u.is_admin).length} admin · {totals.buyers} compradores ·{" "}
          <span className="whitespace-nowrap">LTV médio {formatBRL(totals.avgLtv)}</span>
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">E-mail</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Cadastro</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Pedidos</th>
              <th className="text-right px-4 py-3">LTV</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Último pedido</th>
              <th className="text-left px-4 py-3">Papel</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && filtered.map((u) => (
              <tr key={u.user_id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-right tabular-nums">{u.orders_count}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatBRL(u.ltv)}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                  {u.last_order_at ? new Date(u.last_order_at).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3">
                  {u.is_admin ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Cliente</span>
                  )}
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
                      <>
                        <ShieldOff className="h-3.5 w-3.5" /> Remover admin
                      </>
                    ) : (
                      <>
                        <Shield className="h-3.5 w-3.5" /> Tornar admin
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}