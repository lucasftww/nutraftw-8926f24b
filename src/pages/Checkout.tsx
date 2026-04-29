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
import { ShieldCheck, Truck, CreditCard, QrCode, ArrowLeft, Ticket, Check, MapPin, User as UserIcon, Package, Loader2, ChevronDown, ShoppingBag, AlertCircle, CheckCircle2 } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { trackEvent } from "@/lib/analytics";
import { useFieldValidation } from "@/hooks/useFieldValidation";
import { validateFullName, validateEmail, validatePhoneBR, validateCPF, validateCEP } from "@/lib/validators";
import { isValidCPF } from "@/lib/validators";
import type { FieldStatus } from "@/lib/validators";

const SHIPPING_FALLBACK = 80;
const INSURANCE_RATE = 0.1;
const PIX_DISCOUNT = 0.05;

/** Mensagem inline de validação — verde "ok" / vermelho "erro" / nada quando idle. */
function FieldHint({ status, message }: { status: FieldStatus; message?: string }) {
  if (status === "idle") return null;
  if (status === "valid") {
    return (
      <p className="field-hint field-hint-ok" aria-live="polite">
        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Tudo certo</span>
      </p>
    );
  }
  return (
    <p role="alert" className="field-hint field-hint-error">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

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
  const [insuranceOn, setInsuranceOn] = useState<boolean>(false);
  const [coupon, setCoupon] = useState<any | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponOpen, setCouponOpen] = useState<boolean>(false);

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
  const cepReady = onlyDigits(form.zip).length === 8 && form.state.trim().length === 2;

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
  // Agrupa por product_id (defesa contra linhas duplicadas no carrinho)
  // e ordena por subtotal desc — itens mais "pesados" aparecem primeiro.
  const groupedLines = useMemo(() => {
    const map = new Map<string, { product_id: string; name: string; image_url: string | null; price: number; qty: number }>();
    for (const l of lines) {
      const cur = map.get(l.product_id);
      if (cur) cur.qty += l.qty;
      else map.set(l.product_id, { product_id: l.product_id, name: l.name, image_url: l.image_url ?? null, price: l.price, qty: l.qty });
    }
    return Array.from(map.values()).sort((a, b) => b.price * b.qty - a.price * a.qty);
  }, [lines]);

  const totalQty = useMemo(() => groupedLines.reduce((s, l) => s + l.qty, 0), [groupedLines]);

  const summaryItems = useMemo(
    () =>
      groupedLines.map((l) => (
        <li key={l.product_id} className="flex items-center gap-3 py-2">
          <div className="relative w-11 h-11 rounded-lg border border-border bg-muted/30 overflow-hidden shrink-0 flex items-center justify-center">
            <img
              src={imageUrl(l.image_url, { width: 88, quality: 75 })}
              srcSet={`${imageUrl(l.image_url, { width: 88, quality: 75 })} 1x, ${imageUrl(l.image_url, { width: 176, quality: 75 })} 2x`}
              alt={l.name}
              loading="lazy"
              decoding="async"
              width={44}
              height={44}
              className="w-full h-full object-contain"
            />
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold inline-flex items-center justify-center leading-none ring-2 ring-card">
              {l.qty}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{l.name}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums leading-tight mt-0.5">
              {formatBRL(l.price)} {l.qty > 1 ? `· un` : ""}
            </p>
          </div>
          <span className="text-sm font-bold shrink-0 tabular-nums text-foreground">{formatBRL(l.price * l.qty)}</span>
        </li>
      )),
    [groupedLines],
  );

  // Resumo colapsável no mobile (aberto por padrão no desktop via CSS).
  const [itemsOpen, setItemsOpen] = useState(false);

  // === Validação em tempo real (debounced) — feedback inline ===
  const vName = useFieldValidation(form.full_name, validateFullName);
  const vEmail = useFieldValidation(form.email, validateEmail);
  const vPhone = useFieldValidation(form.phone, validatePhoneBR);
  const vCPF = useFieldValidation(form.cpf, validateCPF);
  const vCEP = useFieldValidation(form.zip, validateCEP, { debounceMs: 200 });

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
    // Bug fix: nome agora exige nome+sobrenome (alinhado ao validador inline).
    if (!form.full_name.trim() || form.full_name.trim().split(/\s+/).filter(p => p.length >= 2).length < 2) {
      toast.error("Informe nome e sobrenome.");
      return false;
    }
    // Bug fix: e-mail era exigido pela UI mas NUNCA validado no submit.
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      toast.error("Informe um e-mail válido.");
      return false;
    }
    // Bug fix: aceitava qualquer 11 dígitos (ex.: 11111111111). Agora roda DV.
    if (!isValidCPF(form.cpf)) {
      toast.error("CPF inválido. Verifique os números digitados.");
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
    // Bug fix (race condition): impede duplo-submit DURANTE a revalidação
    // do cupom. Antes, o `submitting=true` só era setado após o await,
    // o que abria janela para 2 cliques criarem 2 pedidos.
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);

    // Revalida cupom no momento do envio (pode ter expirado / esgotado durante a sessão).
    if (coupon) {
      const res = await revalidateCouponByCode(coupon.code, { silent: true });
      if (!res.ok) {
        toast.error(res.error || "Cupom não pôde ser aplicado. Remova-o para continuar.");
        setSubmitting(false);
        return;
      }
    }
    try {
      // Bug fix: o RPC create_order não recebe e-mail. O e-mail digitado
      // no checkout era jogado fora se o usuário não tinha profile com email.
      // Persistimos no profile (best-effort, não bloqueia o pedido) para
      // que notificações/relatórios admins tenham o contato correto.
      try {
        await (supabase as any)
          .from("profiles")
          .upsert(
            {
              user_id: user!.id,
              email: form.email.trim(),
              full_name: form.full_name.trim(),
              phone: onlyDigits(form.phone),
              cpf: onlyDigits(form.cpf),
              address_zip: onlyDigits(form.zip),
              address_street: form.street.trim(),
              address_number: form.number.trim(),
              address_complement: form.complement.trim() || null,
              address_district: form.district.trim(),
              address_city: form.city.trim(),
              address_state: form.state.trim().toUpperCase(),
            },
            { onConflict: "user_id" }
          );
      } catch (profileErr) {
        console.warn("[Checkout] profile upsert failed (non-blocking)", profileErr);
      }

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
        p_email: form.email.trim() || null,
      });
      if (rpcErr) throw rpcErr;
      void orderId;

      // Bug fix: navegar ANTES de clear() evita um frame com a tela
      // "Seu carrinho está vazio" enquanto a transição acontece.
      toast.success("Pedido criado! Em breve entraremos em contato.");
      nav("/minha-conta");
      clear();
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-10">
      <div className="flex items-center mb-3 sm:mb-6">
        <button
          onClick={() => nav(-1)}
          aria-label="Voltar"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition-colors -ml-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5 lg:gap-8">
        <div className="space-y-4 sm:space-y-6 min-w-0">
          {/* Dados do Comprador */}
          <section className="checkout-card">
            <h2 className="checkout-section-title">Seus dados</h2>
            <div className="space-y-4">
              <div className="checkout-field">
                <label className="checkout-label">Nome Completo *</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  onBlur={vName.touch}
                  placeholder="João da Silva"
                  className="checkout-input"
                  data-status={vName.status === "idle" ? undefined : vName.status}
                  aria-invalid={vName.status === "invalid"}
                  autoComplete="name"
                  maxLength={100}
                />
                <FieldHint status={vName.status} message={vName.message} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="checkout-field">
                  <label className="checkout-label">E-mail *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    onBlur={vEmail.touch}
                    placeholder="joao@exemplo.com"
                    className="checkout-input"
                    data-status={vEmail.status === "idle" ? undefined : vEmail.status}
                    aria-invalid={vEmail.status === "invalid"}
                    autoComplete="email"
                    maxLength={255}
                  />
                  <FieldHint status={vEmail.status} message={vEmail.message} />
                </div>
                <div className="checkout-field">
                  <label className="checkout-label">Telefone (WhatsApp) *</label>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                    onBlur={vPhone.touch}
                    placeholder="(11) 99999-9999"
                    inputMode="tel"
                    className="checkout-input"
                    data-status={vPhone.status === "idle" ? undefined : vPhone.status}
                    aria-invalid={vPhone.status === "invalid"}
                    autoComplete="tel"
                    maxLength={15}
                  />
                  <FieldHint status={vPhone.status} message={vPhone.message} />
                </div>
              </div>
              <div className="checkout-field">
                <label className="checkout-label">CPF *</label>
                <input
                  required
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                  onBlur={vCPF.touch}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className="checkout-input"
                  data-status={vCPF.status === "idle" ? undefined : vCPF.status}
                  aria-invalid={vCPF.status === "invalid"}
                  maxLength={14}
                />
                <FieldHint status={vCPF.status} message={vCPF.message} />
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
                    onBlur={vCEP.touch}
                    placeholder="00000-000"
                    inputMode="numeric"
                    maxLength={9}
                    className="checkout-input pr-10"
                    data-status={vCEP.status === "idle" ? undefined : vCEP.status}
                    aria-invalid={vCEP.status === "invalid"}
                    autoComplete="postal-code"
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
                  )}
                </div>
                {vCEP.status === "invalid" ? (
                  <FieldHint status="invalid" message={vCEP.message} />
                ) : (
                  <p className="text-xs text-muted-foreground ml-1 mt-1.5">
                    Digite o CEP para preenchimento automático do endereço
                  </p>
                )}
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
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center shrink-0">
                    <input
                      type="checkbox"
                      checked={insuranceOn}
                      onChange={(e) => setInsuranceOn(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div
                      className={`w-5 h-5 rounded-md border-2 transition-colors flex items-center justify-center ${
                        insuranceOn ? "bg-primary border-primary" : "border-muted-foreground/40 group-hover:border-primary"
                      }`}
                    >
                      {insuranceOn && <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />}
                    </div>
                  </div>
                  <span className="text-sm text-foreground/90">
                    Adicionar proteção de envio <span className="text-muted-foreground">(+10%)</span>
                  </span>
                </label>
                {!insuranceOn && (
                  <p className="mt-2 ml-8 text-[11px] leading-snug text-muted-foreground">
                    Pedidos sem seguro são de responsabilidade do comprador. Não nos responsabilizamos por problemas no transporte.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Forma de Pagamento */}
          <section className="checkout-card">
            <div className="flex items-center gap-2 mb-5 sm:mb-6">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="checkout-section-title !mb-0">Forma de Pagamento</h2>
            </div>
            {(() => {
              const pixOn = settings.checkout_enable_pix !== "0";
              const cardOn = settings.checkout_enable_card !== "0";
              const noneOn = !pixOn && !cardOn;
              // Total ESTIMADO por método (calculado fora do baseTotal pra mostrar dentro do card)
              const pixTotal = baseTotal * (1 - PIX_DISCOUNT);
              const cardTotal = baseTotal;
              const pixSaves = baseTotal - pixTotal;

              if (noneOn) {
                return (
                  <div role="alert" className="p-4 rounded-xl border-2 border-destructive/30 bg-destructive/5 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-destructive text-sm">Pagamentos indisponíveis</p>
                      <p className="text-xs text-destructive/80 mt-0.5">
                        Nenhum método está habilitado no momento. Fale com o suporte para finalizar.
                      </p>
                    </div>
                  </div>
                );
              }

              const Option = ({
                value,
                title,
                subtitle,
                icon: Icon,
                badge,
                totalLabel,
                totalValue,
                installment,
              }: {
                value: "pix" | "credit_card";
                title: string;
                subtitle: string;
                icon: typeof QrCode;
                badge?: { text: string; tone: "secondary" | "muted" };
                totalLabel: string;
                totalValue: number;
                installment?: string;
              }) => {
                const active = form.payment_method === value;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setForm({ ...form, payment_method: value })}
                    className={[
                      "relative w-full text-left p-4 rounded-2xl border-2 transition-all",
                      "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4",
                      active
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/10 focus-visible:ring-primary/15"
                        : "border-border bg-white hover:border-primary/40 focus-visible:ring-primary/10",
                    ].join(" ")}
                  >
                    {badge && (
                      <span
                        className={[
                          "badge-pill absolute -top-2 right-3 font-extrabold shadow-sm ring-2 ring-card",
                          badge.tone === "secondary"
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        {badge.text}
                      </span>
                    )}
                    <div className="flex items-start gap-3">
                      {/* Radio visual */}
                      <div
                        className={[
                          "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          active ? "border-primary" : "border-muted-foreground/40",
                        ].join(" ")}
                        aria-hidden
                      >
                        {active && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                      </div>
                      <div
                        className={[
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-primary",
                        ].join(" ")}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm leading-tight">{title}</div>
                        <div className="text-[12px] text-muted-foreground mt-0.5 leading-tight">{subtitle}</div>
                      </div>
                    </div>
                    {/* Resumo do total POR MÉTODO */}
                    <div className={`mt-3 pt-3 border-t border-dashed ${active ? "border-primary/30" : "border-border"} flex items-end justify-between gap-2`}>
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground leading-none">
                        {totalLabel}
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-extrabold tabular-nums leading-none ${active ? "text-primary" : "text-foreground"}`}>
                          {formatBRL(totalValue)}
                        </div>
                        {installment && (
                          <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">{installment}</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              };

              return (
                <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {pixOn && (
                    <Option
                      value="pix"
                      title="PIX"
                      subtitle="Aprovação imediata"
                      icon={QrCode}
                      badge={pixSaves > 0 ? { text: `−${formatBRL(pixSaves)}`, tone: "secondary" } : { text: "−5%", tone: "secondary" }}
                      totalLabel="Total no PIX"
                      totalValue={pixTotal}
                    />
                  )}
                  {cardOn && (
                    <Option
                      value="credit_card"
                      title="Cartão de crédito"
                      subtitle="Em até 12x sem juros*"
                      icon={CreditCard}
                      totalLabel="Total no cartão"
                      totalValue={cardTotal}
                      installment={`12x de ${formatBRL(cardTotal / 12)}`}
                    />
                  )}
                </div>
              );
            })()}
            {/* Dica de economia — só aparece se PIX disponível e não for o selecionado */}
            {settings.checkout_enable_pix !== "0" && form.payment_method !== "pix" && baseTotal > 0 && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-success font-semibold">
                <Check className="w-3.5 h-3.5" />
                Pague no PIX e economize {formatBRL(baseTotal * PIX_DISCOUNT)}
              </p>
            )}
          </section>
        </div>

        {/* Resumo do Pedido */}
        <aside className="bg-card p-4 sm:p-6 rounded-2xl shadow-xl shadow-primary/5 border border-primary/10 h-fit lg:sticky lg:top-28">
          {/* Cabeçalho — colapsável no mobile, sempre aberto no desktop */}
          <button
            type="button"
            onClick={() => setItemsOpen((v) => !v)}
            aria-expanded={itemsOpen}
            aria-controls="checkout-summary-items"
            className="w-full flex items-center justify-between gap-3 lg:cursor-default lg:pointer-events-none"
          >
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingBag className="w-5 h-5 text-primary shrink-0" />
              <h2 className="text-base sm:text-xl font-bold tracking-tight">Resumo</h2>
              <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground tabular-nums">
                · {totalQty} {totalQty === 1 ? "item" : "itens"}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-bold text-foreground tabular-nums lg:hidden">{formatBRL(total)}</span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform lg:hidden ${itemsOpen ? "rotate-180" : ""}`}
              />
            </div>
          </button>

          {/* Lista de itens — colapsável no mobile */}
          <ul
            id="checkout-summary-items"
            className={`mt-3 sm:mt-4 mb-4 sm:mb-5 max-h-72 overflow-y-auto pr-1 divide-y divide-border/60 ${itemsOpen ? "block" : "hidden"} lg:block`}
          >
            {summaryItems}
          </ul>

          <div className="space-y-2.5 py-4 border-t border-border text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold tabular-nums">{formatBRL(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
                Frete
                {shippingLoading && (
                  <Loader2 className="h-3 w-3 animate-spin text-primary" aria-label="Atualizando frete" />
                )}
              </span>
              <span className={`font-semibold tabular-nums transition-opacity ${shippingLoading ? "opacity-50" : ""}`}>
                {formatBRL(shippingValue)}
              </span>
            </div>
            {insurance > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seguro</span>
                <span className="font-semibold tabular-nums">{formatBRL(insurance)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-secondary font-semibold">
                <span className="truncate">Cupom {coupon?.code}</span>
                <span className="tabular-nums">−{formatBRL(couponDiscount)}</span>
              </div>
            )}
            {pixDiscount > 0 && (
              <div className="flex justify-between text-secondary font-semibold">
                <span>Desconto PIX</span>
                <span className="tabular-nums">−{formatBRL(pixDiscount)}</span>
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

          {/* Total — compacto e centralizado no mobile */}
          <div className="mt-4 mb-4 flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-muted-foreground">Total</span>
            <div className="text-right">
              <div className="text-2xl sm:text-3xl font-extrabold text-foreground leading-none tabular-nums">
                {formatBRL(grandTotal)}
              </div>
              {form.payment_method === "credit_card" && (
                <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                  ou 12x de {formatBRL(grandTotal / 12)}
                </div>
              )}
              {form.payment_method === "pix" && (couponDiscount + pixDiscount) > 0 && (
                <div className="text-[11px] text-success font-semibold mt-1">
                  Você economiza {formatBRL(couponDiscount + pixDiscount)}
                </div>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full h-12 sm:h-13 rounded-xl bg-success text-success-foreground font-bold text-base hover:bg-success/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all items-center justify-center gap-2 shadow-md shadow-success/25"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processando…</>
            ) : form.payment_method === "pix" ? (
              <><QrCode className="w-5 h-5" /> Pagar com PIX</>
            ) : (
              <><CreditCard className="w-5 h-5" /> Pagar com Cartão</>
            )}
          </button>
        </aside>

      </form>
    </div>
  );
}
