import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, onlyDigits, maskCPF, maskPhone, maskCEP } from "@/lib/utils";
import { imageUrl } from "@/lib/image";
import { toast } from "sonner";
import { ShieldCheck, Truck, Lock, CreditCard, QrCode, ArrowLeft, Ticket, Check, MapPin, User as UserIcon, Package, AlertTriangle, Loader2 } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { trackEvent } from "@/lib/analytics";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";

const SHIPPING_FALLBACK = 80;
const INSURANCE_RATE = 0.1;
const PIX_DISCOUNT = 0.05;

export default function Checkout() {
  const { lines, total, clear, coupon: cartCouponCode, setCoupon: setCartCoupon } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const settings = useSiteSettings();
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  // Cache em memória por UF — evita refetch ao trocar UF e voltar.
  const shippingCacheRef = useRef<Map<string, any[]>>(new Map());
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
    email: "",
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
    // Garante e-mail preenchido mesmo se não houver registro em `profiles` ainda.
    setForm((f) => (f.email ? f : { ...f, email: user.email || "" }));
    let cancelled = false;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[Checkout] profile prefill failed", error);
          return;
        }
        if (!data) return;
        setForm((f) => ({
          ...f,
          full_name: f.full_name || data.full_name || "",
          email: f.email || data.email || user?.email || "",
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
    return () => { cancelled = true; };
  }, [user]);

  // ViaCEP autocomplete — debounced + abortável (evita rate-limit e race conditions)
  useEffect(() => {
    const cep = onlyDigits(form.zip);
    if (cep.length !== 8) return;
    const ctrl = new AbortController();
    let cancelled = false;
    const t = setTimeout(() => {
      setCepLoading(true);
      fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
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
        .finally(() => { if (!cancelled) setCepLoading(false); });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.zip]);

  // Frete dinâmico por UF — recalcula SOMENTE quando a UF muda de verdade.
  // - Normaliza UF (uppercase) e usa em deps para evitar refetch a cada keystroke.
  // - Cacheia por UF em memória: trocar UF e voltar não dispara nova chamada.
  // - Mostra loading discreto enquanto busca.
  const ufNormalized = form.state.trim().toUpperCase();
  useEffect(() => {
    if (ufNormalized.length !== 2) {
      setShippingOptions([]);
      setShippingId(null);
      setShippingLoading(false);
      return;
    }
    // Cache hit: aplica imediatamente, sem loading.
    const cached = shippingCacheRef.current.get(ufNormalized);
    if (cached) {
      setShippingOptions(cached);
      setShippingId((cur) => cached.find((o) => o.id === cur)?.id || cached[0]?.id || null);
      setShippingLoading(false);
      return;
    }
    let cancelled = false;
    setShippingLoading(true);
    (supabase as any)
      .from("shipping_rates")
      .select("*")
      .eq("state", ufNormalized)
      .eq("active", true)
      .order("price")
      .then(({ data }: any) => {
        if (cancelled) return; // evita race quando o usuário troca UF rápido
        const arr = (data as any[]) || [];
        shippingCacheRef.current.set(ufNormalized, arr);
        setShippingOptions(arr);
        setShippingId((cur) => arr.find((o) => o.id === cur)?.id || arr[0]?.id || null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setShippingLoading(false); });
    return () => { cancelled = true; };
  }, [ufNormalized]);

  // Aplica preferência admin para seguro
  useEffect(() => {
    if (settings.insurance_optional === "0") setInsuranceOn(true);
  }, [settings.insurance_optional]);

  // Garante método de pagamento válido conforme settings.
  // Inclui form.payment_method nas deps para reagir imediatamente quando
  // o usuário troca o método manualmente para um que está desabilitado
  // pelo admin (ex.: alterna para PIX e PIX foi desligado).
  useEffect(() => {
    const pixOn = settings.checkout_enable_pix !== "0";
    const cardOn = settings.checkout_enable_card !== "0";
    if (form.payment_method === "pix" && !pixOn && cardOn) {
      setForm((f) => ({ ...f, payment_method: "credit_card" }));
    }
    if (form.payment_method === "credit_card" && !cardOn && pixOn) {
      setForm((f) => ({ ...f, payment_method: "pix" }));
    }
  }, [
    settings.checkout_enable_pix,
    settings.checkout_enable_card,
    form.payment_method,
  ]);

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

  // === Progresso das etapas (derivado, sem novo state) ===
  // Cada etapa "concluída" exige seus campos mínimos válidos.
  const buyerDone =
    form.full_name.trim().length >= 3 &&
    /\S+@\S+\.\S+/.test(form.email) &&
    onlyDigits(form.cpf).length === 11 &&
    onlyDigits(form.phone).length >= 10;
  const addressDone =
    onlyDigits(form.zip).length === 8 &&
    !!form.street.trim() &&
    !!form.number.trim() &&
    !!form.district.trim() &&
    !!form.city.trim() &&
    form.state.trim().length === 2;
  const shippingDone = !!shippingId;
  const paymentDone = !!form.payment_method && (settings.checkout_enable_pix !== "0" || settings.checkout_enable_card !== "0");

  const completedFlags = [buyerDone, addressDone, shippingDone, paymentDone];
  // última etapa concluída de forma contígua a partir do início
  let completedIdx = -1;
  for (let i = 0; i < completedFlags.length; i++) {
    if (completedFlags[i]) completedIdx = i;
    else break;
  }
  const currentIdx = Math.min(completedIdx + 1, completedFlags.length - 1);

  // Mesmas fórmulas usadas no RPC `create_order` para garantir que o resumo
  // exibido aqui bate com o total que o servidor vai gravar.
  const couponDiscount = !coupon ? 0 :
    coupon.discount_type === "percent"
      ? Math.round(total * Number(coupon.discount_value) / 100 * 100) / 100
      : Math.min(Number(coupon.discount_value), total);
  const baseTotal = total + shippingValue + insurance - couponDiscount;
  const pixDiscount = form.payment_method === "pix" ? Math.round(baseTotal * PIX_DISCOUNT * 100) / 100 : 0;
  const grandTotal = baseTotal - pixDiscount;

  // Lista de itens no resumo — memoizada porque depende só de `lines`,
  // que raramente muda durante o checkout. Sem isso, cada keystroke do
  // form re-renderiza todas as <img>/linhas (custo proporcional ao
  // tamanho do carrinho).
  const summaryItems = useMemo(
    () =>
      lines.map((l) => (
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
      )),
    [lines],
  );

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
    const pixOn = settings.checkout_enable_pix !== "0";
    const cardOn = settings.checkout_enable_card !== "0";
    if (!pixOn && !cardOn) {
      toast.error("Pagamentos temporariamente indisponíveis. Contate o suporte.");
      return false;
    }
    if (form.payment_method === "pix" && !pixOn) {
      toast.error("PIX indisponível. Selecione cartão.");
      return false;
    }
    if (form.payment_method === "credit_card" && !cardOn) {
      toast.error("Cartão indisponível. Selecione PIX.");
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-10 pb-28 lg:pb-10">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <button
          onClick={() => nav(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <Lock className="w-3.5 h-3.5 text-success" />
          Compra 100% segura
        </div>
      </div>

      <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight mb-4 sm:mb-6 text-center lg:text-left">
        Finalizar Compra
      </h1>

      <CheckoutSteps current={currentIdx} completed={completedIdx} />

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5 lg:gap-8">
        <div className="space-y-5 sm:space-y-6 min-w-0">
          {/* Dados do Comprador */}
          <section className="checkout-card">
            <div className="flex items-center gap-2 mb-5 sm:mb-6">
              <UserIcon className="w-5 h-5 text-primary" />
              <h2 className="checkout-section-title !mb-0">Dados do Comprador</h2>
            </div>
            <div className="space-y-4">
              <div className="checkout-field">
                <label className="checkout-label">Nome Completo *</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="João da Silva"
                  className="checkout-input"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="checkout-field">
                  <label className="checkout-label">E-mail *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="joao@exemplo.com"
                    className="checkout-input"
                  />
                </div>
                <div className="checkout-field">
                  <label className="checkout-label">Telefone (WhatsApp) *</label>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                    placeholder="(11) 99999-9999"
                    inputMode="tel"
                    className="checkout-input"
                  />
                </div>
              </div>
              <div className="checkout-field">
                <label className="checkout-label">CPF *</label>
                <input
                  required
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className="checkout-input"
                />
              </div>
            </div>
          </section>

          {/* Endereço de Entrega */}
          <section className="checkout-card">
            <div className="flex items-center gap-2 mb-5 sm:mb-6">
              <MapPin className="w-5 h-5 text-primary" />
              <h2 className="checkout-section-title !mb-0">Endereço de Entrega</h2>
            </div>
            <div className="space-y-4">
              <div className="checkout-field">
                <label className="checkout-label">CEP *</label>
                <div className="relative">
                  <input
                    required
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: maskCEP(e.target.value) })}
                    placeholder="00000-000"
                    inputMode="numeric"
                    maxLength={9}
                    className="checkout-input pr-10"
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground ml-1 mt-1.5">
                  Digite o CEP para preenchimento automático do endereço
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 checkout-field">
                  <label className="checkout-label">Rua / Logradouro *</label>
                  <input
                    required
                    value={form.street}
                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                    placeholder="Rua das Flores"
                    className="checkout-input"
                  />
                </div>
                <div className="checkout-field">
                  <label className="checkout-label">Número *</label>
                  <input
                    required
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                    placeholder="123"
                    className="checkout-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="checkout-field">
                  <label className="checkout-label">Complemento</label>
                  <input
                    value={form.complement}
                    onChange={(e) => setForm({ ...form, complement: e.target.value })}
                    placeholder="Apto 12, Bloco B"
                    className="checkout-input"
                  />
                </div>
                <div className="checkout-field">
                  <label className="checkout-label">Bairro *</label>
                  <input
                    required
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    placeholder="Centro"
                    className="checkout-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 checkout-field">
                  <label className="checkout-label">Cidade *</label>
                  <input
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="São Paulo"
                    className="checkout-input"
                  />
                </div>
                <div className="checkout-field">
                  <label className="checkout-label">Estado *</label>
                  <select
                    required
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="checkout-input bg-white appearance-none cursor-pointer"
                  >
                    <option value="">UF</option>
                    {[
                      "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
                      "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
                    ].map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="checkout-field">
                <label className="checkout-label">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Algo que devemos saber sobre a entrega?"
                  className="checkout-input min-h-[80px] py-3 resize-y"
                />
              </div>
            </div>
          </section>

          {/* Entrega e Opções */}
          <section className="checkout-card space-y-6">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              <h2 className="checkout-section-title !mb-0">Entrega e Opções</h2>
              {shippingLoading && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground" aria-live="polite">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  atualizando…
                </span>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Tipo de Frete</label>
              {shippingLoading && shippingOptions.length === 0 ? (
                <ul className="grid grid-cols-1 gap-4" aria-busy="true" aria-label="Calculando opções de frete">
                  {[0, 1].map((i) => (
                    <li key={i} className="p-4 rounded-xl border-2 border-border flex items-center gap-4">
                      <div className="w-5 h-5 rounded-full skeleton-shimmer" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 rounded skeleton-shimmer" />
                        <div className="h-2.5 w-1/4 rounded skeleton-shimmer" />
                      </div>
                      <div className="h-3 w-16 rounded skeleton-shimmer" />
                    </li>
                  ))}
                </ul>
              ) : shippingOptions.length === 0 ? (
                <div className="p-4 rounded-xl bg-muted/30 border border-border text-sm text-muted-foreground">
                  {form.state.length === 2
                    ? "Sem opções de frete para este estado. Fale com o suporte."
                    : "Selecione o estado para ver as opções de frete."}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {shippingOptions.map((o) => {
                    const active = shippingId === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setShippingId(o.id)}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-start gap-4 text-left ${
                          active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div
                          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            active ? "border-primary" : "border-muted-foreground/40"
                          }`}
                        >
                          {active && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-foreground flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            {o.label}
                          </p>
                          {o.delivery_days_min && o.delivery_days_max && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {o.delivery_days_min} a {o.delivery_days_max} dias úteis
                            </p>
                          )}
                          <p className="font-semibold text-primary mt-2">
                            {Number(o.price) === 0 ? "Grátis" : formatBRL(Number(o.price))}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {settings.insurance_optional !== "0" && (
              <div className="pt-4 border-t border-border">
                <label className="flex items-start gap-4 cursor-pointer group">
                  <div className="relative flex items-center justify-center mt-1 shrink-0">
                    <input
                      type="checkbox"
                      checked={insuranceOn}
                      onChange={(e) => setInsuranceOn(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className={`w-6 h-6 rounded-md border-2 transition-colors flex items-center justify-center ${
                        insuranceOn ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary"
                      }`}
                    >
                      {insuranceOn && <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground group-hover:text-primary transition-colors">
                      Adicionar Seguro de Envio (+10%)
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Seguro de envio que garante cobertura em caso de extravio, dano ou problemas na entrega.
                    </p>
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-800 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          Pedidos sem seguro são de responsabilidade do comprador. Não nos responsabilizamos por problemas no transporte.
                        </span>
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            )}
          </section>

          {/* Forma de Pagamento */}
          <section className="checkout-card">
            <div className="flex items-center gap-2 mb-5 sm:mb-6">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="checkout-section-title !mb-0">Forma de Pagamento</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <span className="badge-pill absolute top-2 right-2 bg-secondary text-secondary-foreground font-bold">
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
        </div>

        {/* Resumo do Pedido */}
        <aside className="bg-card p-5 sm:p-6 rounded-2xl shadow-xl shadow-primary/5 border border-primary/10 h-fit lg:sticky lg:top-28">
          <h2 className="text-lg sm:text-xl font-bold mb-5 sm:mb-6 tracking-tight">Resumo do Pedido</h2>
          <div className="space-y-4 mb-5 sm:mb-6 max-h-72 overflow-y-auto pr-2">
            {summaryItems}
          </div>
          <div className="space-y-3 py-4 border-t border-border text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatBRL(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Frete{selectedShipping?.label ? ` (${selectedShipping.label})` : ""}
                {selectedShipping?.delivery_days_min && selectedShipping?.delivery_days_max && (
                  <span className="block text-[10px] mt-0.5">{selectedShipping.delivery_days_min}–{selectedShipping.delivery_days_max} dias úteis</span>
                )}
              </span>
              <span className="font-semibold">{formatBRL(shippingValue)}</span>
            </div>
            {insurance > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seguro (10%)</span>
                <span className="font-semibold">{formatBRL(insurance)}</span>
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
                    <input
                      className="checkout-input pl-9 uppercase"
                      placeholder="Cupom de desconto"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        if (couponError) setCouponError(null);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={couponLoading || !couponInput.trim()}
                    onClick={applyCoupon}
                    className="h-12 px-5 rounded-xl border-2 border-border bg-white font-semibold text-sm hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {couponLoading ? "…" : "Aplicar"}
                  </button>
                </div>
                {couponError && (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {couponError}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex justify-between items-center pt-5 border-t border-border mb-5 sm:mb-6">
            <span className="text-base sm:text-lg font-bold">Total</span>
            <div className="text-right">
              <div className="text-2xl sm:text-3xl font-extrabold text-primary leading-none">
                {formatBRL(grandTotal)}
              </div>
              {form.payment_method === "credit_card" && (
                <div className="text-[11px] text-muted-foreground mt-1">
                  ou 12x de {formatBRL(grandTotal / 12)}
                </div>
              )}
            </div>
          </div>
          {/* CTA desktop */}
          <button
            type="submit"
            disabled={submitting}
            className="hidden lg:inline-flex w-full h-13 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processando…</>
            ) : form.payment_method === "pix" ? (
              <><QrCode className="w-5 h-5" /> Pagar com PIX</>
            ) : (
              <><CreditCard className="w-5 h-5" /> Pagar com Cartão</>
            )}
          </button>
          <p className="hidden lg:flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground text-center mt-3">
            <Lock className="w-3 h-3" /> Pagamento seguro e criptografado
          </p>
        </aside>

        {/* CTA fixa mobile — alta conversão */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">Total</div>
              <div className="text-lg font-extrabold text-primary leading-tight tabular-nums">
                {formatBRL(grandTotal)}
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processando…</>
              ) : form.payment_method === "pix" ? (
                <><QrCode className="w-4 h-4" /> Pagar com PIX</>
              ) : (
                <><CreditCard className="w-4 h-4" /> Pagar com Cartão</>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
