import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/utils";
import { imageUrl } from "@/lib/image";
import { toast } from "sonner";
import { ShieldCheck, Truck, Lock, CreditCard, QrCode, ArrowLeft, Ticket, Check } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { trackEvent } from "@/lib/analytics";

const SHIPPING_FALLBACK = 80;
const INSURANCE_RATE = 0.1;
const PIX_DISCOUNT = 0.05;

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const maskCPF = (s: string) =>
  onlyDigits(s)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const maskPhone = (s: string) => {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a && a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join("")
    );
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
};

const maskCEP = (s: string) =>
  onlyDigits(s).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

export default function Checkout() {
  const { lines, total, clear, coupon: cartCouponCode, setCoupon: setCartCoupon } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const settings = useSiteSettings();
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [insuranceOn, setInsuranceOn] = useState<boolean>(true);
  const [coupon, setCoupon] = useState<any | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Funil: registra `checkout_started` ao chegar na página com itens.
  // Usa um ref-like guard via state pra disparar uma vez por carga.
  useEffect(() => {
    if (lines.length === 0) return;
    void trackEvent("checkout_started", lines[0]?.product_id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pré-carrega + revalida cupom já aplicado no carrinho (drawer).
  useEffect(() => {
    if (!cartCouponCode) return;
    setCouponInput(cartCouponCode);
    void revalidateCouponByCode(cartCouponCode, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza alterações de cupom de volta no carrinho (estado compartilhado).
  // ⚠️ NÃO disparar no mount: isso apagaria o cupom já persistido em
  // localStorage antes mesmo da revalidação assíncrona terminar. Só
  // sincroniza após o usuário aplicar/remover algo nesta sessão.
  const couponMounted = useRef(false);
  useEffect(() => {
    if (!couponMounted.current) {
      couponMounted.current = true;
      return;
    }
    setCartCoupon(coupon?.code ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon?.code]);

  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    phone: "",
    zip: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    notes: "",
    payment_method: "pix" as "pix" | "credit_card",
  });

  // Pre-fill from profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("[Checkout] profile prefill failed", error);
          return;
        }
        if (!data) return;
        setForm((f) => ({
          ...f,
          full_name: f.full_name || data.full_name || "",
          cpf: f.cpf || (data.cpf ? maskCPF(data.cpf) : ""),
          phone: f.phone || (data.phone ? maskPhone(data.phone) : ""),
          zip: f.zip || (data.address_zip ? maskCEP(data.address_zip) : ""),
          street: f.street || data.address_street || "",
          number: f.number || data.address_number || "",
          complement: f.complement || data.address_complement || "",
          district: f.district || data.address_district || "",
          city: f.city || data.address_city || "",
          state: f.state || data.address_state || "",
        }));
      });
  }, [user]);

  // ViaCEP autocomplete — debounced + abortável (evita rate-limit e race conditions)
  useEffect(() => {
    const cep = onlyDigits(form.zip);
    if (cep.length !== 8) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setCepLoading(true);
      fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => {
          if (d.erro) return;
          setForm((f) => ({
            ...f,
            street: f.street || d.logradouro || "",
            district: f.district || d.bairro || "",
            city: f.city || d.localidade || "",
            state: f.state || d.uf || "",
          }));
        })
        .catch(() => {})
        .finally(() => setCepLoading(false));
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.zip]);

  // Frete dinâmico por UF — agora carrega TODAS as modalidades
  useEffect(() => {
    const uf = form.state.toUpperCase();
    if (uf.length !== 2) { setShippingOptions([]); setShippingId(null); return; }
    (supabase as any)
      .from("shipping_rates")
      .select("*")
      .eq("state", uf)
      .eq("active", true)
      .order("price")
      .then(({ data }: any) => {
        const arr = (data as any[]) || [];
        setShippingOptions(arr);
        setShippingId((cur) => arr.find((o) => o.id === cur)?.id || arr[0]?.id || null);
      });
  }, [form.state]);

  // Aplica preferência admin para seguro
  useEffect(() => {
    if (settings.insurance_optional === "0") setInsuranceOn(true);
  }, [settings.insurance_optional]);

  // Garante método de pagamento válido conforme settings
  useEffect(() => {
    const pixOn = settings.checkout_enable_pix !== "0";
    const cardOn = settings.checkout_enable_card !== "0";
    if (form.payment_method === "pix" && !pixOn && cardOn) setForm((f) => ({ ...f, payment_method: "credit_card" }));
    if (form.payment_method === "credit_card" && !cardOn && pixOn) setForm((f) => ({ ...f, payment_method: "pix" }));
  }, [settings.checkout_enable_pix, settings.checkout_enable_card]);

  /**
   * Revalida um cupom contra o subtotal atual e retorna mensagem de erro
   * quando inválido. Nunca lança — fonte da verdade é o RPC `create_order`.
   */
  function checkCouponClientSide(data: any, subtotal: number): string | null {
    if (!data) return "Cupom inválido ou inexistente.";
    if (data.active === false) return "Este cupom não está mais ativo.";
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return "Este cupom expirou.";
    }
    if (data.max_uses != null && Number(data.uses) >= Number(data.max_uses)) {
      return "Este cupom já atingiu o limite de usos.";
    }
    const min = Number(data.min_subtotal || 0);
    if (min > 0 && subtotal < min) {
      return `Subtotal mínimo de ${formatBRL(min)} para usar este cupom (faltam ${formatBRL(min - subtotal)}).`;
    }
    return null;
  }

  async function revalidateCouponByCode(
    rawCode: string,
    opts: { silent?: boolean } = {},
  ): Promise<{ ok: boolean; data?: any; error?: string }> {
    const code = rawCode.trim().toUpperCase();
    if (!code) return { ok: false, error: "Informe um cupom." };
    setCouponLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("coupons")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (error) {
        const msg = "Erro ao validar cupom. Tente novamente.";
        setCouponError(msg);
        if (!opts.silent) toast.error(msg);
        return { ok: false, error: msg };
      }
      const errMsg = checkCouponClientSide(data, total);
      if (errMsg) {
        setCoupon(null);
        setCouponError(errMsg);
        if (!opts.silent) toast.error(errMsg);
        return { ok: false, error: errMsg };
      }
      setCoupon(data);
      setCouponError(null);
      if (!opts.silent) toast.success("Cupom aplicado!");
      return { ok: true, data };
    } catch {
      const msg = "Erro ao validar cupom. Tente novamente.";
      setCouponError(msg);
      if (!opts.silent) toast.error(msg);
      return { ok: false, error: msg };
    } finally {
      setCouponLoading(false);
    }
  }

  async function applyCoupon() {
    await revalidateCouponByCode(couponInput);
  }

  // Re-checa cupom já aplicado sempre que o subtotal mudar (itens / quantidades).
  useEffect(() => {
    if (!coupon) {
      if (couponError && !couponInput) setCouponError(null);
      return;
    }
    const errMsg = checkCouponClientSide(coupon, total);
    setCouponError(errMsg);
    // Não removemos o cupom automaticamente — apenas avisamos o usuário.
    // O RPC do servidor é a fonte da verdade no momento do checkout.
  }, [total, coupon]);

  const selectedShipping = shippingOptions.find((o) => o.id === shippingId);
  const shippingValue = selectedShipping ? Number(selectedShipping.price) : SHIPPING_FALLBACK;
  const insurance = insuranceOn ? Math.round(total * INSURANCE_RATE * 100) / 100 : 0;
  // Mesmas fórmulas usadas no RPC `create_order` para garantir que o resumo
  // exibido aqui bate com o total que o servidor vai gravar.
  const couponDiscount = !coupon ? 0 :
    coupon.discount_type === "percent"
      ? Math.round(total * Number(coupon.discount_value) / 100 * 100) / 100
      : Math.min(Number(coupon.discount_value), total);
  const baseTotal = total + shippingValue + insurance - couponDiscount;
  const pixDiscount = form.payment_method === "pix" ? Math.round(baseTotal * PIX_DISCOUNT * 100) / 100 : 0;
  const grandTotal = baseTotal - pixDiscount;

  if (lines.length === 0)
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">Seu carrinho está vazio.</p>
        <Button onClick={() => nav("/")}>Voltar ao catálogo</Button>
      </div>
    );

  if (!user)
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">Faça login para finalizar o pedido.</p>
        <Button onClick={() => nav("/login?next=/checkout")}>Entrar</Button>
      </div>
    );

  function validate() {
    if (!form.full_name.trim() || form.full_name.trim().length < 3) {
      toast.error("Informe o nome completo.");
      return false;
    }
    if (onlyDigits(form.cpf).length !== 11) {
      toast.error("CPF inválido.");
      return false;
    }
    if (onlyDigits(form.phone).length < 10) {
      toast.error("Telefone inválido.");
      return false;
    }
    if (onlyDigits(form.zip).length !== 8) {
      toast.error("CEP inválido.");
      return false;
    }
    if (!form.street.trim() || !form.number.trim() || !form.district.trim()) {
      toast.error("Preencha rua, número e bairro.");
      return false;
    }
    if (!form.city.trim() || form.state.trim().length !== 2) {
      toast.error("Informe cidade e estado (UF).");
      return false;
    }
    if (!shippingId) {
      toast.error(
        shippingOptions.length === 0
          ? "Não há frete disponível para este estado. Entre em contato pelo WhatsApp."
          : "Selecione uma opção de frete."
      );
      return false;
    }
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Revalida cupom no momento do envio (pode ter expirado / esgotado durante a sessão).
    if (coupon) {
      const res = await revalidateCouponByCode(coupon.code, { silent: true });
      if (!res.ok) {
        toast.error(res.error || "Cupom não pôde ser aplicado. Remova-o para continuar.");
        return;
      }
    }

    setSubmitting(true);
    try {
      // Tudo é validado e calculado server-side via RPC (transação atômica).
      const { data: orderId, error: rpcErr } = await (supabase as any).rpc("create_order", {
        p_items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })),
        p_shipping_id: shippingId,
        p_insurance: insuranceOn,
        p_coupon_code: coupon?.code || null,
        p_payment_method: form.payment_method,
        p_full_name: form.full_name,
        p_cpf: form.cpf,
        p_phone: form.phone,
        p_zip: form.zip,
        p_street: form.street,
        p_number: form.number,
        p_complement: form.complement,
        p_district: form.district,
        p_city: form.city,
        p_state: form.state,
        p_notes: form.notes || null,
      });
      if (rpcErr) throw rpcErr;
      void orderId;

      clear();
      toast.success("Pedido criado! Em breve entraremos em contato.");
      nav("/minha-conta");
    } catch (err: any) {
      const raw: string = err?.message || "Erro ao criar pedido";
      // Mensagens vindas do RPC create_order (Postgres RAISE EXCEPTION)
      if (/cupom inválido/i.test(raw)) {
        setCoupon(null);
        setCouponError("Cupom inválido. Tente outro código.");
        toast.error("Cupom inválido. Removemos do pedido.");
      } else if (/cupom expirado/i.test(raw)) {
        setCoupon(null);
        setCouponError("Este cupom expirou.");
        toast.error("Este cupom expirou. Removemos do pedido.");
      } else if (/cupom esgotado/i.test(raw)) {
        setCoupon(null);
        setCouponError("Este cupom atingiu o limite de usos.");
        toast.error("Cupom esgotado. Removemos do pedido.");
      } else if (/subtotal mínimo/i.test(raw)) {
        setCouponError("Subtotal mínimo do cupom não foi atingido.");
        toast.error("Subtotal mínimo do cupom não foi atingido.");
      } else if (/estoque insuficiente/i.test(raw)) {
        toast.error(raw); // já vem com nome do produto
      } else {
        toast.error(raw);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
      <button
        onClick={() => nav(-1)}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <h1 className="font-display text-2xl md:text-3xl font-extrabold text-primary mb-2">
        Finalizar pedido
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Preencha seus dados de entrega e escolha a forma de pagamento.
      </p>

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8">
        <div className="space-y-6">
          {/* Address */}
          <section className="bg-card rounded-2xl border border-border p-5 md:p-6">
            <h2 className="font-bold text-lg mb-1">Dados de entrega</h2>
            <p className="text-xs text-muted-foreground mb-5">
              Confira atentamente — usamos esses dados na nota fiscal e na entrega.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome completo *</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input
                  required
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone *</Label>
                <Input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                  placeholder="(11) 99999-9999"
                  inputMode="tel"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  CEP * {cepLoading && <span className="text-xs text-muted-foreground ml-1">buscando…</span>}
                </Label>
                <Input
                  required
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: maskCEP(e.target.value) })}
                  placeholder="00000-000"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade *</Label>
                <Input
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Rua *</Label>
                <Input
                  required
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Número *</Label>
                <Input
                  required
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input
                  value={form.complement}
                  onChange={(e) => setForm({ ...form, complement: e.target.value })}
                  placeholder="Apto, bloco…"
                />
              </div>
              <div className="space-y-2">
                <Label>Bairro *</Label>
                <Input
                  required
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>UF *</Label>
                <Input
                  required
                  maxLength={2}
                  value={form.state}
                  onChange={(e) =>
                    setForm({ ...form, state: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observações</Label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Algo que devemos saber sobre a entrega?"
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>
            </div>
          </section>

          {/* Frete */}
          {shippingOptions.length > 0 && (
            <section className="bg-card rounded-2xl border border-border p-5 md:p-6">
              <h2 className="font-bold text-lg mb-1">Tipo de envio</h2>
              <p className="text-xs text-muted-foreground mb-4">Escolha como prefere receber.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {shippingOptions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setShippingId(o.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      shippingId === o.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm flex items-center gap-2"><Truck className="h-4 w-4" />{o.label}</div>
                        {o.delivery_days_min && o.delivery_days_max && (
                          <div className="text-xs text-muted-foreground mt-0.5">{o.delivery_days_min}–{o.delivery_days_max} dias úteis</div>
                        )}
                      </div>
                      <span className="font-bold">{formatBRL(Number(o.price))}</span>
                    </div>
                  </button>
                ))}
              </div>

              {settings.insurance_optional !== "0" && (
                <label className="mt-5 flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={insuranceOn}
                    onChange={(e) => setInsuranceOn(e.target.checked)}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Adicionar seguro de envio (+10%)
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cobre extravio e avaria. Recomendado para pedidos acima de R$ 500.
                    </p>
                  </div>
                  <span className="font-bold text-sm">+{formatBRL(Math.round(total * INSURANCE_RATE * 100) / 100)}</span>
                </label>
              )}
            </section>
          )}

          {/* Payment */}
          <section className="bg-card rounded-2xl border border-border p-5 md:p-6">
            <h2 className="font-bold text-lg mb-4">Forma de pagamento</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {settings.checkout_enable_pix !== "0" && (
              <button
                type="button"
                onClick={() => setForm({ ...form, payment_method: "pix" })}
                className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                  form.payment_method === "pix"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <QrCode className="w-6 h-6 text-primary" />
                  <div>
                    <div className="font-bold text-sm">PIX</div>
                    <div className="text-xs text-muted-foreground">Aprovação imediata</div>
                  </div>
                </div>
                <span className="absolute top-2 right-2 bg-secondary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  −5%
                </span>
              </button>
              )}
              {settings.checkout_enable_card !== "0" && (
              <button
                type="button"
                onClick={() => setForm({ ...form, payment_method: "credit_card" })}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  form.payment_method === "credit_card"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6 text-primary" />
                  <div>
                    <div className="font-bold text-sm">Cartão de crédito</div>
                    <div className="text-xs text-muted-foreground">Em até 12x</div>
                  </div>
                </div>
              </button>
              )}
            </div>
          </section>

          {/* Trust */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center text-center gap-1 p-3 rounded-xl border border-border/60 bg-background">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span className="text-[11px] font-bold">Compra segura</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1 p-3 rounded-xl border border-border/60 bg-background">
              <Truck className="w-5 h-5 text-primary" />
              <span className="text-[11px] font-bold">Envio para todo BR</span>
            </div>
            <div className="flex flex-col items-center text-center gap-1 p-3 rounded-xl border border-border/60 bg-background">
              <Lock className="w-5 h-5 text-primary" />
              <span className="text-[11px] font-bold">Dados criptografados</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <aside className="bg-card rounded-2xl border border-border p-5 md:p-6 h-fit lg:sticky lg:top-24">
          <h2 className="font-bold text-lg mb-4">Resumo</h2>
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-1">
            {lines.map((l) => (
              <div key={l.product_id} className="flex gap-3">
                <div className="w-12 h-12 rounded-lg border border-border bg-muted/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  <img
                    src={imageUrl(l.image_url, { width: 96, quality: 75 })}
                    srcSet={`${imageUrl(l.image_url, { width: 96, quality: 75 })} 1x, ${imageUrl(l.image_url, { width: 192, quality: 75 })} 2x`}
                    alt={l.name}
                    loading="lazy"
                    decoding="async"
                    width={48}
                    height={48}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground line-clamp-2">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.qty}× {formatBRL(l.price)}
                  </p>
                </div>
                <span className="text-xs font-bold shrink-0">{formatBRL(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 py-4 border-t border-border text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatBRL(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Frete{selectedShipping?.label ? ` · ${selectedShipping.label}` : ""}
                {selectedShipping?.delivery_days_min && selectedShipping?.delivery_days_max && (
                  <span className="block text-[10px]">{selectedShipping.delivery_days_min}–{selectedShipping.delivery_days_max} dias úteis</span>
                )}
              </span>
              <span>{formatBRL(shippingValue)}</span>
            </div>
            {insurance > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seguro (10%)</span>
                <span>{formatBRL(insurance)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-secondary font-semibold">
                <span>Cupom {coupon?.code}</span>
                <span>−{formatBRL(couponDiscount)}</span>
              </div>
            )}
            {pixDiscount > 0 && (
              <div className="flex justify-between text-secondary font-semibold">
                <span>Desconto PIX (5%)</span>
                <span>−{formatBRL(pixDiscount)}</span>
              </div>
            )}
          </div>

          {/* Cupom */}
          <div className="border-t border-border pt-4 pb-4">
            {coupon ? (
              <>
                <div
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    couponError ? "bg-destructive/10" : "bg-secondary/10"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Check className={`h-4 w-4 ${couponError ? "text-destructive" : "text-secondary"}`} />
                    <span className="font-semibold">{coupon.code}</span>
                    <span className="text-xs text-muted-foreground">
                      {couponError ? "indisponível" : "aplicado"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCoupon(null);
                      setCouponInput("");
                      setCouponError(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    remover
                  </button>
                </div>
                {couponError && (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {couponError}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9 uppercase"
                      placeholder="Cupom de desconto"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        if (couponError) setCouponError(null);
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={couponLoading || !couponInput.trim()}
                    onClick={applyCoupon}
                  >
                    {couponLoading ? "…" : "Aplicar"}
                  </Button>
                </div>
                {couponError && (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {couponError}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-border mb-5">
            <span className="font-bold">Total</span>
            <div className="text-right">
              <div className="font-display text-2xl font-extrabold text-primary">
                {formatBRL(grandTotal)}
              </div>
              {form.payment_method === "credit_card" && (
                <div className="text-[11px] text-muted-foreground">
                  ou 12x de {formatBRL(grandTotal / 12)}
                </div>
              )}
            </div>
          </div>
          <Button type="submit" disabled={submitting} className="w-full h-12 rounded-full" size="lg">
            {submitting ? "A processar…" : "Confirmar pedido"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-3">
            Ao confirmar, você concorda com nossos termos de compra.
          </p>
        </aside>
      </form>
    </div>
  );
}
