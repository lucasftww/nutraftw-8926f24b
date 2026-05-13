import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { calcTotals } from "@/lib/checkoutMath";
import { validateCheckoutForm } from "@/lib/checkoutValidation";
import { Button } from "@/components/ui/button";
import { formatBRL, onlyDigits, maskCPF, maskPhone, maskCEP } from "@/lib/utils";
import { imageUrl } from "@/lib/image";
import { toast } from "sonner";
import { ShieldCheck, Truck, Lock, CreditCard, QrCode, ArrowLeft, Ticket, Check, MapPin, User as UserIcon, Package, Loader2, ChevronDown, ShoppingBag, AlertCircle, CheckCircle2 } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { trackEvent } from "@/lib/analytics";
import { getAffiliateRefData, clearAffiliateRef } from "@/lib/affiliateRef";
import { CheckoutStepper } from "@/components/checkout/CheckoutStepper";
import { useSEO } from "@/hooks/useSEO";

// Sub-components
import { BuyerSection } from "./checkout/BuyerSection";
import { AddressSection } from "./checkout/AddressSection";
import { ShippingSection } from "./checkout/ShippingSection";
import { PaymentSection } from "./checkout/PaymentSection";
import { OrderSummary } from "./checkout/OrderSummary";
import { StickyMobileBar } from "./checkout/StickyMobileBar";
import { loadPersistedForm, FORM_STORAGE_KEY } from "./checkout/storage";
import type { CheckoutFormState } from "./checkout/types";

const INSURANCE_RATE = 0.1;
const PIX_DISCOUNT = 0.05;

export default function Checkout() {
  const { lines, total, clear, coupon: cartCouponCode, setCoupon: setCartCoupon } = useCart();

  useSEO({
    title: "Finalizar compra — Royal Vitta",
    description:
       "Conclua seu pedido na Royal Vitta com pagamento seguro via PIX (5% de desconto) ou cartão em até 3x. Frete rastreado para todo o Brasil.",
    robots: "noindex,follow",
  });

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

  // Funil: registra `checkout_started` na primeira vez que o usuário chega
  // ao checkout com itens no carrinho. Antes, o effect rodava só no mount
  // com `[]` — se o carrinho ainda estivesse hidratando do localStorage,
  // o `lines.length` era 0 e o evento nunca disparava. Agora aguardamos
  // os itens chegarem e usamos um ref para garantir disparo único.
  const checkoutStartedRef = useRef(false);
  useEffect(() => {
    if (checkoutStartedRef.current) return;
    if (lines.length === 0) return;
    checkoutStartedRef.current = true;
    void trackEvent("checkout_started", lines[0]?.product_id ?? null);
  }, [lines.length]);

  // Pré-carrega + revalida cupom já aplicado no carrinho (drawer).
  useEffect(() => {
    if (!cartCouponCode) return;
    setCouponInput(cartCouponCode);
    void revalidateCouponByCode(cartCouponCode, { silent: true });
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
  }, [coupon?.code]);

  // Hidrata do sessionStorage no mount (lazy initializer — só roda 1x).
  const [form, setForm] = useState<CheckoutFormState>(loadPersistedForm);

  // Persiste em sessionStorage a cada mudança. Debounce-light: salvar a
  // cada keystroke é barato (sessionStorage é síncrono mas ~µs aqui).
  // Não persistimos `notes` se vazio para manter o blob menor — opcional.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form));
    } catch {
      // Quota cheia / modo privado: silencioso, não é crítico.
    }
  }, [form]);

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
    // Depende só do ID do usuário — `user` é uma nova referência a cada
    // TOKEN_REFRESHED do Supabase (a cada hora), o que causaria refetch
    // desnecessário do profile durante o checkout.
  }, [user?.id, user?.email]);

  // ViaCEP autocomplete — debounced + abortável (evita rate-limit e race conditions)
  // Bug fix UX: antes, CEP inexistente caía em silêncio. Agora avisamos o
  // usuário (toast leve) para preencher manualmente. Marcamos um ref para
  // não repetir o mesmo aviso quando o useEffect re-roda no mesmo CEP.
  const lastCepNotFoundRef = useRef<string | null>(null);
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
          if (d.erro) {
            if (lastCepNotFoundRef.current !== cep) {
              lastCepNotFoundRef.current = cep;
              toast.warning("CEP não encontrado. Preencha o endereço manualmente.");
            }
            return;
          }
          lastCepNotFoundRef.current = null;
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
    // Bug fix UX: antes, falha de rede deixava a seção vazia até o usuário
    // trocar UF e voltar. Agora tentamos 1 retry com backoff curto antes
    // de desistir — comum em conexões mobile flutuando.
    const fetchRates = async (attempt: number): Promise<any[]> => {
      const { data, error } = await (supabase as any)
        .from("shipping_rates")
        .select("*")
        .eq("state", ufNormalized)
        .eq("active", true)
        .order("price");
      if (error && attempt < 1) {
        await new Promise((r) => setTimeout(r, 400));
        return fetchRates(attempt + 1);
      }
      if (error) throw error;
      return (data as any[]) || [];
    };
    fetchRates(0)
      .then((arr) => {
        if (cancelled) return;
        shippingCacheRef.current.set(ufNormalized, arr);
        setShippingOptions(arr);
        setShippingId((cur) => arr.find((o) => o.id === cur)?.id || arr[0]?.id || null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Checkout] shipping_rates fetch failed", err);
        setShippingOptions([]);
      })
      .finally(() => { if (!cancelled) setShippingLoading(false); });
    return () => { cancelled = true; };
  }, [ufNormalized]);

  // Aplica preferência admin para seguro
  useEffect(() => {
    if (settings.insurance_optional === "0") setInsuranceOn(true);
  }, [settings.insurance_optional]);

  // Fase 4: pré-carrega tabelas de frete dos UFs mais comuns em background.
  // Quando o usuário digitar a UF, exibimos instantaneamente (cache hit).
  // Não bloqueia render; falhas são silenciosas (apenas perde o pré-cache).
  useEffect(() => {
    const COMMON_UFS = ["SP", "RJ", "MG", "RS", "PR"];
    let cancelled = false;
    const id = setTimeout(() => {
      void Promise.all(
        COMMON_UFS.map(async (uf) => {
          if (shippingCacheRef.current.has(uf)) return;
          try {
            const { data, error } = await (supabase as any)
              .from("shipping_rates")
              .select("*")
              .eq("state", uf)
              .eq("active", true)
              .order("price");
            if (error || cancelled) return;
            shippingCacheRef.current.set(uf, (data as any[]) || []);
          } catch { /* silencioso */ }
        }),
      );
    }, 250); // pequeno delay para não competir com o render inicial
    return () => { cancelled = true; clearTimeout(id); };
  }, []);

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
      const { data, error } = await (supabase as any).rpc("validate_coupon", {
        p_code: code,
        p_subtotal: total,
      });
      if (error) {
        const msg = "Erro ao validar cupom. Tente novamente.";
        setCouponError(msg);
        if (!opts.silent) toast.error(msg);
        return { ok: false, error: msg };
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.valid) {
        const errMsg = row?.message || "Cupom inválido.";
        setCoupon(null);
        setCouponError(errMsg);
        if (!opts.silent) toast.error(errMsg);
        return { ok: false, error: errMsg };
      }
      // Validação dos números: dado corrompido no banco (string não-numérica)
      // antes virava 0 silenciosamente, desalinhando o desconto exibido do
      // que o RPC create_order calcularia. Agora rejeitamos explicitamente.
      const dvNum = Number(row.discount_value);
      const daNum = Number(row.discount_amount);
      if (!Number.isFinite(dvNum) || dvNum < 0) {
        const errMsg = "Cupom com configuração inválida. Tente outro código.";
        setCoupon(null);
        setCouponError(errMsg);
        if (!opts.silent) toast.error(errMsg);
        console.error("[Checkout] invalid coupon discount_value", row);
        return { ok: false, error: errMsg };
      }
      // Mantém o mesmo shape do antigo SELECT * (campos consumidos no resto do checkout).
      const couponData = {
        code: row.code,
        description: row.description,
        discount_type: row.discount_type,
        discount_value: dvNum,
        discount_amount: Number.isFinite(daNum) && daNum >= 0 ? daNum : 0,
        active: true,
      };
      setCoupon(couponData);
      setCouponError(null);
      if (!opts.silent) toast.success("Cupom aplicado!");
      return { ok: true, data: couponData };
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
    // Depender de `coupon.code` (string estável) em vez do objeto evita
    // re-disparar este efeito quando `setCoupon` substitui a referência
    // sem mudar de cupom efetivo.
  }, [total, coupon?.code, coupon?.discount_type, coupon?.discount_value]);

  const selectedShipping = shippingOptions.find((o) => o.id === shippingId);
  // Frete: usa valor real selecionado. Não aplicamos fallback "fantasma":
  // se a UF não tem tarifa cadastrada, o RPC `create_order` rejeita o pedido
  // — mostrar um valor estimado no resumo só confunde o cliente.
  const cepReady = onlyDigits(form.zip).length === 8 && form.state.trim().length === 2;
  // Centralizado em src/lib/checkoutMath.ts — paridade testada com o RPC
  // create_order. Mantém o mesmo comportamento (sem fallback de frete,
  // PIX 5%, seguro 10%, cupom percentual ou fixo limitado ao subtotal).
  const _totals = calcTotals({
    subtotal: total,
    shipping: selectedShipping ? Number(selectedShipping.price) : null,
    insurance: insuranceOn,
    coupon: coupon
      ? { type: coupon.discount_type === "percent" ? "percent" : "fixed", value: Number(coupon.discount_value || 0) }
      : null,
    paymentMethod: form.payment_method as "pix" | "credit_card",
  });
  const shippingValue = _totals.shipping;
  const shippingKnown = _totals.shippingKnown;
  const insurance = _totals.insurance;

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
  // Bug visual: o passo 3 ficava verde de cara porque o PIX é pré-selecionado.
  // Usuário via "Pagamento ✓" antes de preencher nada. Agora só conta como
  // concluído quando os passos anteriores também estão prontos.
  const paymentMethodAvailable =
    settings.checkout_enable_pix !== "0" || settings.checkout_enable_card !== "0";
  // "Selecionado" — usado pra liberar o botão de finalizar.
  const paymentSelected =
    !!form.payment_method && paymentMethodAvailable && buyerDone && addressDone && shippingDone;
  // "Concluído" no stepper — vira ✓ quando todos os passos anteriores
  // estão prontos e um método de pagamento foi escolhido. Sem isso a
  // barra de progresso travava em 50% mesmo com tudo preenchido.
  const paymentDone = paymentSelected;

  // Mesmas fórmulas usadas no RPC `create_order` para garantir que o resumo
  // exibido aqui bate com o total que o servidor vai gravar.
  // Cupom: replicamos EXATAMENTE a fórmula do RPC create_order (server-side
  // é a fonte da verdade). Antes priorizávamos `discount_amount` retornado
  // por validate_coupon, mas esse valor é congelado no momento da validação
  // — se o subtotal mudar depois (carrinho sincronizando entre abas), o
  // resumo mostrava um desconto desalinhado do que o servidor cobraria.
  // Recalcular client-side com a mesma fórmula garante paridade visual
  // com o pedido criado.
  // Mantemos os mesmos nomes de variáveis para não tocar na UI; valores
  // vêm do helper centralizado em `calcTotals` (paridade com create_order).
  const couponDiscount = _totals.couponDiscount;
  const pixDiscount = _totals.pixDiscount;
  const grandTotal = _totals.total;
  // baseTotal mantido para a UI legada (parcelas/"ou em x vezes").
  const baseTotal = total + shippingValue + insurance - couponDiscount;

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
      groupedLines.map((l, idx) => {
        // As 3 primeiras linhas do resumo são quase sempre o que o usuário
        // vê de imediato no mobile (acima da dobra). `eager` + fetchpriority
        // high garante que essas miniaturas apareçam sem flash, mesmo em 4G.
        const aboveFold = idx < 3;
        return (
        <li key={l.product_id} className="flex items-center gap-3 py-2">
          <div className="relative w-11 h-11 rounded-lg border border-border bg-muted/30 overflow-hidden shrink-0 flex items-center justify-center">
            <img
              src={imageUrl(l.image_url, { width: 88, quality: 75 })}
              srcSet={`${imageUrl(l.image_url, { width: 88, quality: 75 })} 1x, ${imageUrl(l.image_url, { width: 176, quality: 75 })} 2x`}
              alt={l.name}
              loading={aboveFold ? "eager" : "lazy"}
              decoding="async"
              {...(aboveFold ? { fetchpriority: "high" } as Record<string, string> : {})}
              width={44}
              height={44}
              className="w-full h-full object-contain"
            />
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold inline-flex items-center justify-center leading-none ring-2 ring-card">
              {l.qty}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground leading-tight line-clamp-2">{l.name}</p>
            {l.qty > 1 && (
              <p className="text-[11px] text-muted-foreground tabular-nums leading-tight mt-0.5">
                {formatBRL(l.price)} · un
              </p>
            )}
          </div>
          <span className="text-sm font-bold shrink-0 tabular-nums text-foreground">{formatBRL(l.price * l.qty)}</span>
        </li>
        );
      }),
    [groupedLines],
  );

  // Resumo colapsável no mobile (aberto por padrão no desktop via CSS).
  const [itemsOpen, setItemsOpen] = useState(false);

  // Bug visual: no mobile, ao rolar até o resumo, o botão "Pagar com PIX"
  // do card e a sticky bar "Continuar" apareciam juntos, competindo pela
  // mesma ação. Observamos o CTA do resumo e escondemos a sticky bar quando
  // ele está visível na tela.
  const summaryCtaRef = useRef<HTMLButtonElement | null>(null);
  const [summaryCtaVisible, setSummaryCtaVisible] = useState(false);
  // Roda apenas no mount: o ref aponta para o mesmo botão durante toda a
  // vida do componente. Antes dependia de `grandTotal`, o que recriava o
  // observer a cada keystroke (cupom/frete) e fazia a sticky bar piscar.
  useEffect(() => {
    const el = summaryCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setSummaryCtaVisible(entry.isIntersecting),
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (lines.length === 0)
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center flex flex-col items-center">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
          <ShoppingBag className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-1">Seu carrinho está vazio</h2>
        <p className="text-muted-foreground mb-6 max-w-sm">Confira nossos produtos e aproveite as ofertas exclusivas.</p>
        <Button
          onClick={() => nav("/")}
          className="h-12 px-8 rounded-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold shadow-cta"
        >
          Ver catálogo
        </Button>
      </div>
    );

  function validate() {
    const pixOn = settings.checkout_enable_pix !== "0";
    const cardOn = settings.checkout_enable_card !== "0";
    const error = validateCheckoutForm(form, {
      shippingId,
      shippingOptionsCount: shippingOptions.length,
      pixEnabled: pixOn,
      cardEnabled: cardOn,
    });
    if (error) {
      toast.error(error);
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
      // === Auto-criar conta para guests ===
      // Se o usuário não está logado, criamos uma conta silenciosamente com o
      // e-mail digitado e uma senha gerada (CPF + sufixo). Caso o e-mail já
      // exista, tentamos login com a mesma senha — se falhar, orientamos a
      // usar outro e-mail ou recuperar a senha. Isso mantém `auth.uid()`
      // válido para o RPC `create_order` e RLS, sem mudar a arquitetura.
      let activeUserId = user?.id;
      if (!activeUserId) {
        const emailTrim = form.email.trim().toLowerCase();
        // ⚠️ SEGURANÇA: senha do guest precisa ser aleatória e descartável.
        // Versões anteriores usavam `gi#${cpf}A1` (determinística), o que
        // permitia a qualquer pessoa que soubesse o e-mail + CPF logar na
        // conta e ver todos os pedidos/endereço — CPF não é segredo no BR.
        // Agora geramos 24 bytes de aleatoriedade via Web Crypto. Se o
        // e-mail já existir, mandamos o cliente fazer login normal.
        const autoPassword = (() => {
          const bytes = new Uint8Array(24);
          crypto.getRandomValues(bytes);
          return (
            "Gi!" +
            Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("")
          );
        })();

        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: emailTrim,
          password: autoPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: form.full_name.trim() },
          },
        });

        if (signUpErr) {
          // Conta já existe → não há como tentar "login silencioso" com a
          // nova senha aleatória. Pedimos para o cliente fazer login normal
          // (ou recuperar senha) e voltar ao checkout.
          const looksRegistered = /registered|already|exists/i.test(signUpErr.message);
          if (looksRegistered) {
            toast.error(
              "Já existe uma conta com este e-mail. Faça login para continuar.",
            );
            nav(`/login?next=/checkout&email=${encodeURIComponent(emailTrim)}`);
            setSubmitting(false);
            return;
          } else {
            throw signUpErr;
          }
        } else {
          activeUserId = signUpData.user?.id ?? signUpData.session?.user?.id;
          // Se confirmação de e-mail estiver habilitada, signUp não cria sessão.
          // Tentamos login imediato com a senha gerada para obter `auth.uid()`.
          if (!signUpData.session) {
            const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
              email: emailTrim,
              password: autoPassword,
            });
            // Bug fix: sem sessão ativa o RPC create_order falha com
            // "Usuário não autenticado" porque auth.uid() é null. Antes,
            // seguíamos com activeUserId vindo do signUp e o erro só
            // aparecia depois, confuso para o cliente.
            if (signInErr || !signInData?.session?.user) {
              toast.error(
                "Conta criada, mas precisamos confirmar seu e-mail. Verifique sua caixa de entrada e tente novamente.",
              );
              setSubmitting(false);
              return;
            }
            activeUserId = signInData.session.user.id;
          }
        }

        if (!activeUserId) {
          toast.error(
            "Não conseguimos criar sua conta automaticamente. Verifique o e-mail e tente novamente.",
          );
          setSubmitting(false);
          return;
        }
      }

      // Fase 3: profile.upsert e affiliate attribution agora ocorrem
      // dentro do RPC `create_order` (mesma transação do pedido).
      // Isso elimina dados órfãos quando o RPC falha após gravar o profile.
      const refData = getAffiliateRefData();
      const affiliateCode = refData?.code ?? null;
      const utmPayload = refData
        ? {
            utm_source: refData.utm_source ?? null,
            utm_medium: refData.utm_medium ?? null,
            utm_campaign: refData.utm_campaign ?? null,
            utm_term: refData.utm_term ?? null,
            utm_content: refData.utm_content ?? null,
            landing_path: refData.landing_path ?? null,
            referrer: refData.referrer ?? null,
          }
        : null;

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
        p_save_profile: true,
        p_affiliate_code: affiliateCode,
        p_utm: utmPayload,
      });
      if (rpcErr) throw rpcErr;

      const createdOrderId = typeof orderId === "string" ? orderId : null;
      let paymentRedirectUrl: string | null = null;
      let paymentWarning: string | null = null;
      if (createdOrderId) {
        try {
          const { data: paymentData, error: payErr } = await supabase.functions.invoke("create-payment-intent", {
            body: {
              order_id: createdOrderId,
              method: form.payment_method,
            },
          });
          // supabase.functions.invoke NÃO joga em status != 2xx — vem em `error`.
          // Sem este check, falhas do gateway (ex.: limite MisticPay R$1000)
          // ficavam silenciosas e o cliente ia pra /minha-conta sem QR Code.
          if (payErr) {
            const ctx: any = (payErr as any)?.context;
            let providerMsg = "";
            try {
              const body = await ctx?.json?.();
              providerMsg =
                body?.details?.message ||
                (typeof body?.details === "string" ? body.details : "") ||
                body?.error || "";
            } catch { /* noop */ }
            paymentWarning = providerMsg
              ? `Pedido criado, mas o PIX falhou: ${providerMsg}`
              : "Pedido criado, mas o PIX ainda não foi gerado. Tente novamente em alguns instantes.";
          } else if (paymentData && typeof paymentData === "object" && "checkout_url" in paymentData) {
            paymentRedirectUrl = String((paymentData as Record<string, unknown>).checkout_url || "");
          }
        } catch {
          // Integração de gateway opcional: se não existir função configurada,
          // mantemos fluxo de pedido criado sem quebrar checkout.
        }
      }

      // Bug fix: navegar ANTES de clear() evita um frame com a tela
      // "Seu carrinho está vazio" enquanto a transição acontece.
      if (paymentWarning) {
        toast.error(paymentWarning, { duration: 8000 });
      } else {
        toast.success("Pedido criado com sucesso!");
      }
      // Limpa atribuição de afiliado — pedido criado, comissão registrada.
      try { clearAffiliateRef(); } catch {}
      // Limpa o rascunho persistido — pedido já foi gravado.
      try { window.sessionStorage.removeItem(FORM_STORAGE_KEY); } catch {}
      clear();
      if (paymentRedirectUrl) {
        window.location.href = paymentRedirectUrl;
        return;
      }
      nav(createdOrderId ? `/minha-conta?pedido=${encodeURIComponent(createdOrderId)}` : "/minha-conta");
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

  const pixEnabled = settings.checkout_enable_pix !== "0";
  const cardEnabled = settings.checkout_enable_card !== "0";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-10 pb-44 md:pb-10">
      <div className="flex items-center mb-3 sm:mb-4">
        <button
          onClick={() => nav(-1)}
          aria-label="Voltar"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition-colors -ml-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="ml-1 text-base sm:text-lg font-bold text-foreground">Finalizar pedido</h1>
      </div>

      {/* Stepper — guia visual de progresso. Não troca de tela: apenas
          espelha o estado das seções (`buyerDone` / `addressDone+shippingDone` /
          `paymentDone`). Reduz ansiedade do usuário em formulários longos. */}
      <CheckoutStepper
        buyerDone={buyerDone}
        addressDone={addressDone}
        shippingDone={shippingDone}
        paymentDone={paymentDone}
      />

      <form
        onSubmit={submit}
        data-checkout-form
        className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5 lg:gap-8"
      >
        <div className="space-y-4 sm:space-y-6 min-w-0">
          {/* Dados do Comprador */}
          <BuyerSection form={form} setForm={setForm} />

          {/* Endereço de Entrega */}
          <AddressSection form={form} setForm={setForm} cepLoading={cepLoading} />

          {/* Entrega — só aparece após CEP/UF preenchidos */}
          {cepReady && (
            <ShippingSection
              form={form}
              shippingOptions={shippingOptions}
              shippingId={shippingId}
              shippingLoading={shippingLoading}
              insuranceOn={insuranceOn}
              setShippingId={setShippingId}
              setInsuranceOn={setInsuranceOn}
              insuranceOptional={settings.insurance_optional}
            />
          )}

          {/* Forma de Pagamento */}
          <PaymentSection
            form={form}
            setForm={setForm}
            baseTotal={baseTotal}
            pixEnabled={pixEnabled}
            cardEnabled={cardEnabled}
          />
        </div>

        {/* Resumo do Pedido */}
        <OrderSummary
          form={form}
          total={total}
          totalQty={totalQty}
          summaryItems={summaryItems}
          itemsOpen={itemsOpen}
          setItemsOpen={setItemsOpen}
          shippingValue={shippingValue}
          shippingKnown={shippingKnown}
          shippingLoading={shippingLoading}
          insurance={insurance}
          couponDiscount={couponDiscount}
          pixDiscount={pixDiscount}
          grandTotal={grandTotal}
          baseTotal={baseTotal}
          coupon={coupon}
          couponInput={couponInput}
          couponLoading={couponLoading}
          couponError={couponError}
          couponOpen={couponOpen}
          setCouponInput={setCouponInput}
          setCouponOpen={setCouponOpen}
          setCoupon={setCoupon}
          setCouponError={setCouponError}
          applyCoupon={applyCoupon}
          submitting={submitting}
          summaryCtaRef={summaryCtaRef}
        />

      </form>

      {/* Sticky bottom bar mobile — total + CTA sempre visível.
          Mesmo padrão da página de produto. Só aparece quando há total e
          o CTA do resumo NÃO está visível na tela (evita dois botões
          concorrentes lado a lado). */}
      {grandTotal > 0 && !summaryCtaVisible && (
        <StickyMobileBar
          grandTotal={grandTotal}
          pixDiscount={pixDiscount}
          submitting={submitting}
          buyerDone={buyerDone}
          addressDone={addressDone}
          shippingDone={shippingDone}
          paymentSelected={paymentSelected}
          form={form}
        />
      )}
    </div>
  );
}
