import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, User as UserIcon, MapPin, ShoppingBag, Eye, Loader2, Users, Copy, Check, Wallet, ChevronRight, ChevronLeft, Mail, Share2 } from "lucide-react";
import { formatBRL, maskCPF, maskPhone, maskCEP } from "@/lib/utils";
import { CustomerOrderDetail } from "@/components/account/CustomerOrderDetail";

type Tab = "profile" | "address" | "orders" | "affiliate" | "commissions";

const TABS: { id: Tab; label: string; description: string; icon: any }[] = [
  { id: "profile",     label: "Dados pessoais", description: "Nome, telefone e CPF",     icon: UserIcon },
  { id: "address",     label: "Endereço",       description: "Para entrega dos pedidos", icon: MapPin },
  { id: "orders",      label: "Meus pedidos",   description: "Histórico de compras",     icon: ShoppingBag },
  { id: "affiliate",   label: "Afiliação",      description: "Indique e ganhe 1%",       icon: Users },
  { id: "commissions", label: "Comissões",      description: "Pagamentos e status",       icon: Wallet },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Aguardando pagamento", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Pago", color: "bg-emerald-100 text-emerald-700" },
  processing: { label: "Em preparação", color: "bg-blue-100 text-blue-700" },
  shipped: { label: "Enviado", color: "bg-indigo-100 text-indigo-700" },
  delivered: { label: "Entregue", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-700" },
  refunded: { label: "Reembolsado", color: "bg-gray-100 text-gray-700" },
};

export default function MyAccount() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  // Afiliação
  const [affStats, setAffStats] = useState({
    released: 0,
    pending: 0,
    paid: 0,
    activeRefs: 0,
    inactiveRefs: 0,
  });
  const [copied, setCopied] = useState(false);
  const [savingPixel, setSavingPixel] = useState(false);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loadingComm, setLoadingComm] = useState(false);
  const [commFilter, setCommFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setProfile(data || {}); });
    supabase.from("orders").select("id, status, total, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) setOrders(data || []); });
    return () => { cancelled = true; };
  }, [user]);

  // Carrega estatísticas de afiliação ao abrir a aba.
  useEffect(() => {
    if (!user || tab !== "affiliate") return;
    let cancelled = false;
    (async () => {
      const [{ data: comm }, { data: refs }] = await Promise.all([
        supabase.from("affiliate_commissions").select("amount, status").eq("affiliate_user_id", user.id),
        supabase.from("affiliate_referrals").select("status").eq("affiliate_user_id", user.id),
      ]);
      if (cancelled) return;
      const sumBy = (st: string) => (comm || []).filter((c: any) => c.status === st).reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      const pending = sumBy("pending");
      const released = sumBy("released");
      const paid = sumBy("paid");
      const activeRefs = (refs || []).filter((r: any) => r.status === "active").length;
      const inactiveRefs = (refs || []).filter((r: any) => r.status === "inactive").length;
      setAffStats({ released, pending, paid, activeRefs, inactiveRefs });
    })();
    return () => { cancelled = true; };
  }, [user, tab]);

  // Carrega lista detalhada de comissões.
  useEffect(() => {
    if (!user || tab !== "commissions") return;
    let cancelled = false;
    setLoadingComm(true);
    (async () => {
      const { data, error } = await supabase
        .from("affiliate_commissions")
        .select("id, amount, status, created_at, released_at, paid_at, eligible_release_at, cancellation_reason, cancelled_at, order_id, orders(id, total, status, created_at, shipping_full_name)")
        .eq("affiliate_user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) toast.error(error.message);
      setCommissions(data || []);
      setLoadingComm(false);
    })();
    return () => { cancelled = true; };
  }, [user, tab]);

  const affiliateUrl = useMemo(() => {
    if (!profile?.affiliate_code) return "";
    return `${window.location.origin}/r/${profile.affiliate_code}`;
  }, [profile?.affiliate_code]);

  async function copyLink() {
    if (!affiliateUrl) return;
    try {
      await navigator.clipboard.writeText(affiliateUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  async function savePixel() {
    if (!user) return;
    setSavingPixel(true);
    const { error } = await supabase.from("profiles")
      .update({ facebook_pixel: profile.facebook_pixel?.trim() || null })
      .eq("user_id", user.id);
    setSavingPixel(false);
    if (error) toast.error(error.message);
    else toast.success("Pixel salvo!");
  }

  async function lookupCEP(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await r.json();
      if (d.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      setProfile((p: any) => ({
        ...p,
        address_street: d.logradouro || p.address_street,
        address_district: d.bairro || p.address_district,
        address_city: d.localidade || p.address_city,
        address_state: d.uf || p.address_state,
      }));
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name || null,
      phone: profile.phone?.replace(/\D/g, "") || null,
      cpf: profile.cpf?.replace(/\D/g, "") || null,
      address_zip: profile.address_zip?.replace(/\D/g, "") || null,
      address_street: profile.address_street || null,
      address_number: profile.address_number || null,
      address_complement: profile.address_complement || null,
      address_district: profile.address_district || null,
      address_city: profile.address_city || null,
      address_state: profile.address_state || null,
    }).eq("user_id", user!.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado!");
  }

  async function logout() {
    await supabase.auth.signOut();
    nav("/", { replace: true });
  }

  const stats = useMemo(() => {
    const total = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    return { count: orders.length, total };
  }, [orders]);

  return (
    <div className="container py-4 md:py-12 max-w-5xl">
      {/* ===== Hero header — perfil, identidade, sair ===== */}
      <div className="bg-gradient-to-br from-primary to-primary/85 rounded-2xl md:rounded-3xl text-primary-foreground p-5 md:p-7 mb-4 md:mb-6 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-lg md:text-xl font-extrabold shrink-0 ring-2 ring-white/20">
              {(profile?.full_name || user?.email || "?").trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">Minha conta</p>
              <h1 className="font-display text-xl md:text-3xl font-extrabold leading-tight truncate">
                {profile?.full_name || "Olá!"}
              </h1>
              <p className="text-xs md:text-sm text-white/80 flex items-center gap-1.5 mt-0.5 truncate">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{user?.email}</span>
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            aria-label="Sair"
            className="shrink-0 h-10 w-10 md:h-auto md:w-auto md:px-4 md:py-2 rounded-full md:rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30 backdrop-blur flex items-center justify-center md:gap-2 transition-colors text-sm font-semibold"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Sair</span>
          </button>
        </div>

        {/* Stats embutidos no hero — mobile-first */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 mt-5">
          <div className="bg-white/10 backdrop-blur rounded-xl md:rounded-2xl p-3 md:p-4">
            <p className="text-[10px] md:text-xs uppercase tracking-wide text-white/70 font-semibold">Pedidos</p>
            <p className="text-xl md:text-2xl font-extrabold mt-0.5">{stats.count}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl md:rounded-2xl p-3 md:p-4">
            <p className="text-[10px] md:text-xs uppercase tracking-wide text-white/70 font-semibold">Gasto</p>
            <p className="text-base md:text-2xl font-extrabold mt-0.5 truncate">{formatBRL(stats.total)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl md:rounded-2xl p-3 md:p-4">
            <p className="text-[10px] md:text-xs uppercase tracking-wide text-white/70 font-semibold">Desde</p>
            <p className="text-base md:text-2xl font-extrabold mt-0.5 capitalize">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "")
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ===== Navegação mobile: lista estilo iOS quando nenhuma aba ativa específica ===== */}
      {/* No mobile mostramos sempre a lista + a seção em sequência (com âncora de volta).
          No desktop, tabs horizontais clássicas. */}
      <div className="hidden md:flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Mobile: lista de seções (estilo app) */}
      <div className="md:hidden mb-4">
        <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                  active ? "bg-primary/5" : "active:bg-muted/40"
                }`}
              >
                <span className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  <t.icon className="h-4 w-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}>{t.label}</span>
                  <span className="block text-xs text-muted-foreground truncate">{t.description}</span>
                </span>
                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${active ? "rotate-90 text-primary" : "text-muted-foreground"}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Cabeçalho da seção ativa — só mobile, dá contexto + clean */}
      <div className="md:hidden flex items-center gap-2 mb-3 px-1">
        {(() => {
          const current = TABS.find((t) => t.id === tab);
          if (!current) return null;
          const Icon = current.icon;
          return (
            <>
              <Icon className="h-4 w-4 text-primary" />
              <h2 className="font-display text-base font-bold text-primary">{current.label}</h2>
            </>
          );
        })()}
      </div>

      {(tab === "profile" || tab === "address") && (
        <form onSubmit={save} className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-4">
          {tab === "profile" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={profile.full_name || ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={user?.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input inputMode="tel" value={maskPhone(profile.phone || "")} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input inputMode="numeric" value={maskCPF(profile.cpf || "")} onChange={(e) => setProfile({ ...profile, cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
            </div>
          )}

          {tab === "address" && (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>CEP</Label>
                <div className="relative">
                  <Input
                    inputMode="numeric"
                    value={maskCEP(profile.address_zip || "")}
                    onChange={(e) => {
                      const v = e.target.value;
                      setProfile({ ...profile, address_zip: v });
                      if (v.replace(/\D/g, "").length === 8) lookupCEP(v);
                    }}
                    placeholder="00000-000"
                  />
                  {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Rua</Label>
                <Input value={profile.address_street || ""} onChange={(e) => setProfile({ ...profile, address_street: e.target.value })} />
              </div>
              <div className="space-y-2 grid-cols-2 grid sm:block gap-3 sm:gap-0">
                <div className="space-y-2">
                <Label>Número</Label>
                <Input inputMode="numeric" value={profile.address_number || ""} onChange={(e) => setProfile({ ...profile, address_number: e.target.value })} />
                </div>
                <div className="space-y-2 sm:hidden">
                  <Label>UF</Label>
                  <Input value={profile.address_state || ""} onChange={(e) => setProfile({ ...profile, address_state: e.target.value.toUpperCase() })} maxLength={2} />
                </div>
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label>Complemento</Label>
                <Input value={profile.address_complement || ""} onChange={(e) => setProfile({ ...profile, address_complement: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={profile.address_district || ""} onChange={(e) => setProfile({ ...profile, address_district: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Cidade</Label>
                <Input value={profile.address_city || ""} onChange={(e) => setProfile({ ...profile, address_city: e.target.value })} />
              </div>
              <div className="space-y-2 hidden sm:block">
                <Label>UF</Label>
                <Input value={profile.address_state || ""} onChange={(e) => setProfile({ ...profile, address_state: e.target.value.toUpperCase() })} maxLength={2} />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-border">
            <Button type="submit" disabled={saving} size="lg" className="w-full sm:w-auto sm:ml-auto sm:flex">
              {saving ? "A guardar…" : "Guardar alterações"}
            </Button>
          </div>
        </form>
      )}

      {tab === "orders" && (
        orders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border text-center py-12 md:py-16 px-6">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 mx-auto flex items-center justify-center mb-3">
              <ShoppingBag className="h-7 w-7 text-muted-foreground/70" />
            </div>
            <p className="text-foreground font-semibold">Nenhum pedido ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Quando você comprar, ele aparece aqui.</p>
            <Button className="mt-4" onClick={() => nav("/")}>Explorar produtos</Button>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {orders.map((o) => {
              const status = STATUS_LABELS[o.status] || { label: o.status, color: "bg-muted text-foreground" };
              return (
                <li key={o.id}>
                  <button
                    onClick={() => setOrderId(o.id)}
                    className="w-full text-left bg-card rounded-2xl border border-border p-4 hover:border-primary/40 active:scale-[0.99] transition-all flex items-center gap-3"
                  >
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[11px] text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()}</p>
                        <p className="font-display font-extrabold text-primary text-base">{formatBRL(o.total)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}

      {orderId && <CustomerOrderDetail orderId={orderId} onClose={() => setOrderId(null)} />}

      {tab === "affiliate" && (
        <div className="space-y-4">
          {/* Banner */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <h2 className="font-display text-lg font-bold text-primary">Programa de indicações</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Compartilhe seu link e ganhe <strong>1% de comissão</strong> nas compras aprovadas.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Comissões pendentes</p>
              <p className="text-2xl font-extrabold mt-1 text-amber-600">{formatBRL(affStats.pending)}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Comissões liberadas</p>
              <p className="text-2xl font-extrabold mt-1 text-primary">{formatBRL(affStats.released)}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Comissões pagas</p>
              <p className="text-2xl font-extrabold mt-1 text-emerald-600">{formatBRL(affStats.paid)}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Indicações ativas</p>
              <p className="text-2xl font-extrabold mt-1">{affStats.activeRefs}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Indicações inativas</p>
              <p className="text-2xl font-extrabold mt-1">{affStats.inactiveRefs}</p>
            </div>
          </div>

          <div className="bg-muted/30 rounded-xl border border-border p-4 text-xs text-muted-foreground">
            <strong className="text-foreground">Como funciona o pagamento:</strong> ao aprovar o pedido, sua comissão fica
            <span className="text-amber-600 font-semibold"> pendente</span> por 7 dias. Após esse período ela é
            <span className="text-primary font-semibold"> liberada</span> automaticamente para saque, e quando o administrador
            efetua o repasse passa a <span className="text-emerald-600 font-semibold">paga</span>.
          </div>

          {/* Link de divulgação */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <div>
              <h3 className="font-display font-bold text-primary">Link de divulgação</h3>
              <p className="text-sm text-muted-foreground">Ganhe 1% de comissão nas compras aprovadas de produtos da loja.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={affiliateUrl} readOnly className="bg-muted/40 font-mono text-sm" />
              <Button type="button" variant="outline" onClick={copyLink} className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Código de afiliado: <span className="font-mono font-semibold text-foreground">{profile?.affiliate_code || "—"}</span>
            </p>
          </div>

          {/* Pixel do Facebook */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <div>
              <h3 className="font-display font-bold text-primary">Pixel do Facebook</h3>
              <p className="text-sm text-muted-foreground">Adicione seu Pixel para rastrear as conversões geradas pelas suas indicações.</p>
            </div>
            <Input
              value={profile.facebook_pixel || ""}
              onChange={(e) => setProfile({ ...profile, facebook_pixel: e.target.value })}
              placeholder="Ex.: 123456789012345"
              inputMode="numeric"
            />
            <div className="flex justify-end">
              <Button type="button" onClick={savePixel} disabled={savingPixel}>
                {savingPixel ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "commissions" && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-primary">Minhas comissões</h2>
                <p className="text-sm text-muted-foreground mt-1">Histórico completo das comissões geradas pelas suas indicações.</p>
              </div>
              <div className="flex gap-1 text-xs">
                {[
                  { id: "all", label: "Todas" },
                  { id: "pending", label: "Pendentes" },
                  { id: "released", label: "Liberadas" },
                  { id: "paid", label: "Pagas" },
                  { id: "cancelled", label: "Canceladas" },
                  { id: "clawback", label: "Estornadas" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setCommFilter(f.id)}
                    className={`px-3 py-1.5 rounded-full border transition ${commFilter === f.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            {loadingComm ? (
              <div className="p-10 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> <span className="ml-2 text-sm">Carregando…</span>
              </div>
            ) : (() => {
              const filtered = commissions.filter((c) => commFilter === "all" || c.status === commFilter);
              if (filtered.length === 0) {
                return (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    Nenhuma comissão {commFilter === "all" ? "registrada" : `com status "${commFilter}"`} no momento.
                  </div>
                );
              }
              const statusBadge: Record<string, string> = {
                pending: "bg-amber-100 text-amber-700",
                released: "bg-blue-100 text-blue-700",
                paid: "bg-emerald-100 text-emerald-700",
                cancelled: "bg-red-100 text-red-700",
                clawback: "bg-orange-100 text-orange-700",
              };
              const statusLabel: Record<string, string> = {
                pending: "Pendente",
                released: "Liberada",
                paid: "Paga",
                cancelled: "Cancelada",
                clawback: "Estornada",
              };
              const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="text-left px-4 py-3">Pedido</th>
                        <th className="text-left px-4 py-3">Valor</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-left px-4 py-3">Gerada em</th>
                        <th className="text-left px-4 py-3">Liberação</th>
                        <th className="text-left px-4 py-3">Pagamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-foreground">{c.order_id ? `#${String(c.order_id).slice(0, 8)}` : "—"}</div>
                            {c.orders?.total != null && (
                              <div className="text-xs text-muted-foreground">Pedido: {formatBRL(Number(c.orders.total))}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-primary">{formatBRL(Number(c.amount || 0))}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[c.status] || "bg-gray-100 text-gray-700"}`}>
                              {statusLabel[c.status] || c.status}
                            </span>
                            {c.cancellation_reason && (c.status === "cancelled" || c.status === "clawback") && (
                              <div className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                                {c.cancellation_reason}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.created_at)}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {c.released_at
                              ? fmtDate(c.released_at)
                              : c.status === "pending" && c.eligible_release_at
                                ? <span className="text-xs">Prevista: {fmtDate(c.eligible_release_at)}</span>
                                : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.paid_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
