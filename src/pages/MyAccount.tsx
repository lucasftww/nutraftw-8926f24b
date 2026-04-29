import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, User as UserIcon, MapPin, ShoppingBag, Loader2, Users, Copy, Check, Wallet, ChevronRight, Mail, Share2 } from "lucide-react";
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

  async function shareLink() {
    if (!affiliateUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "GIMPORTS — Loja farmacêutica",
          text: "Use meu link e confira os produtos:",
          url: affiliateUrl,
        });
      } catch { /* usuário cancelou */ }
    } else {
      copyLink();
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
    <div className="container px-4 md:px-6 py-4 md:py-12 max-w-5xl space-y-4 md:space-y-6">
      {/* ===== Hero header — perfil, identidade, sair ===== */}
      <div className="bg-gradient-to-br from-primary via-primary to-primary/80 rounded-2xl md:rounded-3xl text-primary-foreground p-4 md:p-7 shadow-card relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <div className="h-10 w-10 md:h-14 md:w-14 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-base md:text-xl font-extrabold shrink-0 ring-2 ring-white/20">
              {(profile?.full_name || user?.email || "?").trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-[11px] uppercase tracking-[0.14em] text-white/60 font-semibold">Minha conta</p>
              <h1 className="font-display text-base md:text-3xl font-extrabold leading-tight truncate mt-0.5">
                {profile?.full_name || "Bem-vindo"}
              </h1>
              <p className="text-[11px] md:text-sm text-white/70 flex items-center gap-1.5 mt-0.5 truncate">
                <Mail className="h-3 w-3 shrink-0 opacity-80" />
                <span className="truncate">{user?.email}</span>
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            aria-label="Sair"
            className="shrink-0 h-9 w-9 md:h-auto md:w-auto md:px-4 md:py-2 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30 backdrop-blur flex items-center justify-center md:gap-2 transition-colors text-sm font-semibold"
          >
            <LogOut className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden md:inline">Sair</span>
          </button>
        </div>

        {/* Stats embutidos no hero — mobile-first */}
        <div className="relative grid grid-cols-3 gap-1.5 md:gap-3 mt-4 md:mt-6">
          <div className="bg-white/10 backdrop-blur rounded-xl md:rounded-2xl px-2.5 py-2 md:p-4">
            <p className="text-[9px] md:text-xs uppercase tracking-wide text-white/60 font-semibold">Pedidos</p>
            <p className="text-base md:text-2xl font-extrabold mt-1 tabular-nums leading-none">{stats.count}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl md:rounded-2xl px-2.5 py-2 md:p-4">
            <p className="text-[9px] md:text-xs uppercase tracking-wide text-white/60 font-semibold">Gasto</p>
            <p className="text-[13px] md:text-2xl font-extrabold mt-1 truncate tabular-nums leading-none">{formatBRL(stats.total)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl md:rounded-2xl px-2.5 py-2 md:p-4">
            <p className="text-[9px] md:text-xs uppercase tracking-wide text-white/60 font-semibold">Desde</p>
            <p className="text-[13px] md:text-2xl font-extrabold mt-1 capitalize leading-none">
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
      <div className="hidden md:flex gap-1 border-b border-border overflow-x-auto">
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
      <div className="md:hidden">
        <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border/60">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  active ? "bg-primary/5" : "active:bg-muted/40"
                }`}
              >
                <span className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground"
                }`}>
                  <t.icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[13px] font-semibold leading-tight ${active ? "text-primary" : "text-foreground"}`}>{t.label}</span>
                  <span className="block text-[11px] text-muted-foreground/80 truncate mt-0.5">{t.description}</span>
                </span>
                <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${active ? "rotate-90 text-primary" : "text-muted-foreground/60"}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Cabeçalho da seção ativa — só mobile, dá contexto + clean */}
      <div className="md:hidden flex items-center gap-2 px-1 -mb-1">
        {(() => {
          const current = TABS.find((t) => t.id === tab);
          if (!current) return null;
          const Icon = current.icon;
          return (
            <>
              <span className="h-1 w-4 rounded-full bg-primary" />
              <h2 className="text-[10px] uppercase tracking-[0.14em] font-bold text-primary/80">{current.label}</h2>
            </>
          );
        })()}
      </div>

      {(tab === "profile" || tab === "address") && (
        <form onSubmit={save} className="bg-card rounded-2xl border border-border p-4 md:p-6 space-y-4 md:space-y-5">
          {tab === "profile" && (
            <div className="grid sm:grid-cols-2 gap-3.5 md:gap-4">
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
            <div className="grid sm:grid-cols-3 gap-3.5 md:gap-4">
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

          <div className="pt-3 border-t border-border/70">
            <Button type="submit" disabled={saving} size="lg" className="w-full sm:w-auto sm:ml-auto sm:flex">
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      )}

      {tab === "orders" && (
        orders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border text-center py-12 md:py-16 px-6">
            <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-muted/60 mx-auto flex items-center justify-center mb-3.5">
              <ShoppingBag className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground/70" />
            </div>
            <p className="text-foreground font-semibold text-[14px] md:text-[15px]">Nenhum pedido ainda</p>
            <p className="text-[12px] md:text-[13px] text-muted-foreground mt-1">Quando você comprar, ele aparece aqui.</p>
            <Button className="mt-4 md:mt-5" onClick={() => nav("/")}>Explorar produtos</Button>
          </div>
        ) : (
          <ul className="space-y-1.5 md:space-y-2">
            {orders.map((o) => {
              const status = STATUS_LABELS[o.status] || { label: o.status, color: "bg-muted text-foreground" };
              return (
                <li key={o.id}>
                  <button
                    onClick={() => setOrderId(o.id)}
                    className="w-full text-left bg-card rounded-2xl border border-border p-3 md:p-4 hover:border-primary/40 active:scale-[0.99] transition-all flex items-center gap-3"
                  >
                    <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">#{o.id.slice(0, 8)}</p>
                        <p className="font-display font-extrabold text-primary text-[14px] md:text-[15px] tabular-nums">{formatBRL(o.total)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-semibold ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-[10px] md:text-[11px] text-muted-foreground tabular-nums">
                          {new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}

      {orderId && <CustomerOrderDetail orderId={orderId} onClose={() => setOrderId(null)} />}

      {tab === "affiliate" && (
        <div className="space-y-2.5 md:space-y-4">
          {/* Hero do programa: foco mobile, CTA grande de compartilhar */}
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 p-3.5 md:p-6">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-[15px] md:text-xl font-extrabold text-primary leading-tight">Programa de indicações</h2>
                <p className="text-[12px] md:text-sm text-muted-foreground mt-0.5 leading-relaxed">
                  Compartilhe seu link e ganhe <strong className="text-foreground">1% de comissão</strong> em cada compra aprovada.
                </p>
              </div>
            </div>

            {/* Link + ações */}
            <div className="mt-3.5 space-y-2">
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
                <span className="text-[9px] md:text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold shrink-0">Link</span>
                <span className="font-mono text-[11px] md:text-xs text-foreground truncate flex-1">{affiliateUrl || "—"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" onClick={shareLink} size="lg" className="w-full">
                  <Share2 className="h-4 w-4" /> Compartilhar
                </Button>
                <Button type="button" variant="outline" onClick={copyLink} size="lg" className="w-full">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
              </div>
              <p className="text-[10px] md:text-[11px] text-muted-foreground text-center pt-0.5">
                Código: <span className="font-mono font-semibold text-foreground">{profile?.affiliate_code || "—"}</span>
              </p>
            </div>
          </div>

          {/* Stats — 2 colunas no mobile (3 linhas simétricas), 5 em desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-1.5 md:gap-3">
            <div className="bg-card rounded-2xl border border-border p-2.5 md:p-4">
              <p className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-wide font-semibold">Pendentes</p>
              <p className="text-[15px] md:text-2xl font-extrabold mt-1 text-amber-600 truncate tabular-nums leading-none">{formatBRL(affStats.pending)}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-2.5 md:p-4">
              <p className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-wide font-semibold">Liberadas</p>
              <p className="text-[15px] md:text-2xl font-extrabold mt-1 text-primary truncate tabular-nums leading-none">{formatBRL(affStats.released)}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-2.5 md:p-4 col-span-2 lg:col-span-1">
              <p className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-wide font-semibold">Pagas</p>
              <p className="text-[15px] md:text-2xl font-extrabold mt-1 text-emerald-600 truncate tabular-nums leading-none">{formatBRL(affStats.paid)}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-2.5 md:p-4">
              <p className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-wide font-semibold">Indic. ativas</p>
              <p className="text-[15px] md:text-2xl font-extrabold mt-1 tabular-nums leading-none">{affStats.activeRefs}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-2.5 md:p-4">
              <p className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-wide font-semibold">Indic. inativas</p>
              <p className="text-[15px] md:text-2xl font-extrabold mt-1 tabular-nums leading-none">{affStats.inactiveRefs}</p>
            </div>
          </div>

          <div className="bg-muted/40 rounded-2xl border border-border/70 p-3.5 md:p-4 text-[11px] md:text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground block mb-1 text-[12px] md:text-[13px]">Como funciona</strong>
            Ao pedido aprovar, a comissão fica <span className="text-amber-600 font-semibold">pendente</span> por 7 dias.
            Depois é <span className="text-primary font-semibold">liberada</span> automaticamente e, quando o administrador efetua o repasse, passa a <span className="text-emerald-600 font-semibold">paga</span>.
          </div>

          {/* Pixel do Facebook */}
          <div className="bg-card rounded-2xl border border-border p-3.5 md:p-5 space-y-3">
            <div>
              <h3 className="font-display font-bold text-primary text-[14px] md:text-base">Pixel do Facebook</h3>
              <p className="text-[11px] md:text-sm text-muted-foreground mt-0.5 leading-relaxed">Adicione seu Pixel para rastrear as conversões das suas indicações.</p>
            </div>
            <Input
              value={profile.facebook_pixel || ""}
              onChange={(e) => setProfile({ ...profile, facebook_pixel: e.target.value })}
              placeholder="Ex.: 123456789012345"
              inputMode="numeric"
            />
            <Button type="button" onClick={savePixel} disabled={savingPixel} className="w-full sm:w-auto sm:ml-auto sm:flex">
              {savingPixel ? "Salvando…" : "Salvar Pixel"}
            </Button>
          </div>
        </div>
      )}

      {tab === "commissions" && (
        <div className="space-y-2.5 md:space-y-4">
          <div className="bg-card rounded-2xl border border-border p-3.5 md:p-5">
            <h2 className="font-display text-[14px] md:text-lg font-bold text-primary">Histórico de comissões</h2>
            <p className="text-[11px] md:text-sm text-muted-foreground mt-0.5">Geradas pelas suas indicações.</p>
            <div className="-mx-3.5 md:mx-0 mt-2.5 px-3.5 md:px-0 overflow-x-auto scrollbar-thin [mask-image:linear-gradient(to_right,black_85%,transparent)] md:[mask-image:none]">
              <div className="flex gap-1.5 text-xs whitespace-nowrap pb-1">
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
                    className={`px-3 py-1.5 rounded-full border text-[11px] md:text-xs font-semibold transition shrink-0 ${commFilter === f.id ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background text-muted-foreground hover:bg-muted/50"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(() => {
            if (loadingComm) {
              return (
                <div className="bg-card rounded-2xl border border-border p-10 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> <span className="ml-2 text-[13px]">Carregando…</span>
                </div>
              );
            }
            const filtered = commissions.filter((c) => commFilter === "all" || c.status === commFilter);
            if (filtered.length === 0) {
              return (
                <div className="bg-card rounded-2xl border border-border p-10 text-center text-[13px] md:text-sm text-muted-foreground">
                  <Wallet className="h-9 w-9 mx-auto text-muted-foreground/40 mb-3" />
                  Nenhuma comissão {commFilter === "all" ? "registrada" : "com este status"} no momento.
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
              <>
                {/* Mobile: lista de cards */}
                <ul className="md:hidden space-y-2">
                  {filtered.map((c) => (
                    <li key={c.id} className="bg-card rounded-2xl border border-border p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {c.order_id ? `#${String(c.order_id).slice(0, 8)}` : "—"}
                          </p>
                          <p className="text-lg font-extrabold text-primary leading-none mt-1.5 tabular-nums">{formatBRL(Number(c.amount || 0))}</p>
                          {c.orders?.total != null && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              do pedido {formatBRL(Number(c.orders.total))}
                            </p>
                          )}
                        </div>
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${statusBadge[c.status] || "bg-gray-100 text-gray-700"}`}>
                          {statusLabel[c.status] || c.status}
                        </span>
                      </div>
                      {c.cancellation_reason && (c.status === "cancelled" || c.status === "clawback") && (
                        <p className="text-[11px] text-muted-foreground mt-2.5 italic leading-relaxed">{c.cancellation_reason}</p>
                      )}
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/70 text-[11px]">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gerada</p>
                          <p className="font-semibold text-foreground mt-0.5 tabular-nums">{fmtDate(c.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Liberação</p>
                          <p className="font-semibold text-foreground mt-0.5 tabular-nums">
                            {c.released_at
                              ? fmtDate(c.released_at)
                              : c.status === "pending" && c.eligible_release_at
                                ? fmtDate(c.eligible_release_at)
                                : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pago</p>
                          <p className="font-semibold text-foreground mt-0.5 tabular-nums">{fmtDate(c.paid_at)}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Desktop: tabela */}
                <div className="hidden md:block bg-card rounded-2xl border border-border overflow-hidden">
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
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
