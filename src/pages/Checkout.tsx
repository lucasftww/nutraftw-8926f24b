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
import { ShieldCheck, Truck, Lock, CreditCard, QrCode, ArrowLeft, Ticket, Check, MapPin, User as UserIcon, Package, Loader2, ChevronDown, ShoppingBag, AlertCircle, CheckCircle2 } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { trackEvent } from "@/lib/analytics";
import { useFieldValidation } from "@/hooks/useFieldValidation";
import { validateFullName, validateEmail, validatePhoneBR, validateCPF, validateCEP } from "@/lib/validators";
import { isValidCPF } from "@/lib/validators";
import type { FieldStatus } from "@/lib/validators";
import { getAffiliateRefData, clearAffiliateRef } from "@/lib/affiliateRef";

const SHIPPING_FALLBACK = 80;
const INSURANCE_RATE = 0.1;
const PIX_DISCOUNT = 0.05;

/**
 * Persistência leve do form em sessionStorage. Evita perder o que o usuário
 * digitou se ele recarregar a página por engano (acidente comum em mobile
 * com pull-to-refresh). Sessão limpa sozinha ao fechar a aba — sem rastros.
 * Só dados de contato/endereço — nunca senha. Senhas nem passam por aqui.
 */
const FORM_STORAGE_KEY = "checkout:form:v1";
type CheckoutFormState = {
  full_name: string; email: string; cpf: string; phone: string;
  zip: string; street: string; number: string; complement: string;
  district: string; city: string; state: string; notes: string;
  payment_method: "pix" | "credit_card";
};
const EMPTY_FORM: CheckoutFormState = {
  full_name: "", email: "", cpf: "", phone: "",
  zip: "", street: "", number: "", complement: "",
  district: "", city: "", state: "", notes: "",
  payment_method: "pix",
};
function loadPersistedForm(): CheckoutFormState {
  if (typeof window === "undefined") return EMPTY_FORM;
  try {
    const raw = window.sessionStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return EMPTY_FORM;
    const parsed = JSON.parse(raw) as Partial<CheckoutFormState>;
    return { ...EMPTY_FORM, ...parsed };
  } catch {
    return EMPTY_FORM;
  }
}

/**
 * Cartão de método de pagamento (PIX / Cartão).
 * Bug fix: antes era declarado DENTRO de `Checkout`. Resultado: a cada
 * keystroke nos campos do form, React via uma "função-componente nova"
 * e desmontava/remontava o card inteiro — animações reiniciavam, ARIA
 * resetava, e em mobile alguns toques eram engolidos pela troca rápida
 * de árvore. Movido pra fora, mantém referência estável entre renders.
 */
function PaymentOption({
  value,
  active,
  onSelect,
  title,
  subtitle,
  icon: Icon,
  badge,
  totalLabel,
  totalValue,
  installment,
}: {
  value: "pix" | "credit_card";
  active: boolean;
  onSelect: (v: "pix" | "credit_card") => void;
  title: string;
  subtitle: string;
  icon: typeof QrCode;
  badge?: { text: string; tone: "secondary" | "muted" };
  totalLabel: string;
  totalValue: number;
  installment?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(value)}
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
              ? "bg-success text-success-foreground badge-pulse"
              : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {badge.text}
        </span>
      )}
      <div className="flex items-start gap-3">
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
}

/** Mensagem inline de validação — verde "ok" / vermelho "erro" / nada quando idle.
 *  `id` permite vincular ao input via aria-describedby (acessibilidade). */
function FieldHint({ status, message, id }: { status: FieldStatus; message?: string; id?: string }) {
  if (status === "idle") return null;
  if (status === "valid") {
    return (
      <p id={id} className="field-hint field-hint-ok" aria-live="polite">
        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Tudo certo</span>
      </p>
    );
  }
  return (
    <p id={id} role="alert" className="field-hint field-hint-error">
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
  const [complementOpen, setComplementOpen] = useState<boolean>(false);

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
  }, [user]);

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
      // Mantém o mesmo shape do antigo SELECT * (campos consumidos no resto do checkout).
      const couponData = {
        code: row.code,
        description: row.description,
        discount_type: row.discount_type,
        discount_value: Number(row.discount_value || 0),
        discount_amount: Number(row.discount_amount || 0),
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
  }, [total, coupon]);

  const selectedShipping = shippingOptions.find((o) => o.id === shippingId);
  // Bug fix: antes usávamos SHIPPING_FALLBACK (R$ 80) sempre que não havia frete
  // selecionado — incluindo o estado inicial, sem CEP. Resultado: o resumo mostrava
  // "Frete R$ 80,00" e somava no total mesmo sem o usuário ter informado endereço.
  // Agora só caímos no fallback se o CEP estiver completo mas não conseguimos
  // carregar uma tarifa; sem CEP, o frete fica zerado e a UI mostra "—".
  const cepFilled = onlyDigits(form.zip).length === 8 && form.state.trim().length === 2;
  const shippingValue = selectedShipping
    ? Number(selectedShipping.price)
    : cepFilled
      ? SHIPPING_FALLBACK
      : 0;
  const shippingKnown = !!selectedShipping || cepFilled;
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
  // Bug visual: o passo 3 ficava verde de cara porque o PIX é pré-selecionado.
  // Usuário via "Pagamento ✓" antes de preencher nada. Agora só conta como
  // concluído quando os passos anteriores também estão prontos.
  const paymentMethodAvailable =
    settings.checkout_enable_pix !== "0" || settings.checkout_enable_card !== "0";
  const paymentDone =
    !!form.payment_method && paymentMethodAvailable && buyerDone && addressDone && shippingDone;

  // Mesmas fórmulas usadas no RPC `create_order` para garantir que o resumo
  // exibido aqui bate com o total que o servidor vai gravar.
  // Cupom: replicamos EXATAMENTE a fórmula do RPC create_order (server-side
  // é a fonte da verdade). Antes priorizávamos `discount_amount` retornado
  // por validate_coupon, mas esse valor é congelado no momento da validação
  // — se o subtotal mudar depois (carrinho sincronizando entre abas), o
  // resumo mostrava um desconto desalinhado do que o servidor cobraria.
  // Recalcular client-side com a mesma fórmula garante paridade visual
  // com o pedido criado.
  const couponDiscount = !coupon
    ? 0
    : coupon.discount_type === "percent"
      ? Math.round((total * Number(coupon.discount_value || 0)) / 100 * 100) / 100
      : Math.min(Number(coupon.discount_value || 0), total);
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
  useEffect(() => {
    const el = summaryCtaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setSummaryCtaVisible(entry.isIntersecting),
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [grandTotal]);

  // === Validação em tempo real (debounced) — feedback inline ===
  const vName = useFieldValidation(form.full_name, validateFullName);
  const vEmail = useFieldValidation(form.email, validateEmail);
  const vPhone = useFieldValidation(form.phone, validatePhoneBR);
  const vCPF = useFieldValidation(form.cpf, validateCPF);
  const vCEP = useFieldValidation(form.zip, validateCEP, { debounceMs: 200 });

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

        // === Atribuição de afiliado para guest ===
        // Bug fix: o checkout-guest criava a conta mas IGNORAVA o ref salvo
        // em localStorage. Resultado: clientes que vinham de /r/CODIGO e
        // compravam direto (sem passar pelo /login) nunca geravam comissão
        // para o afiliado. Replicamos aqui a mesma lógica do Login.tsx,
        // respeitando first-touch (não sobrescreve atribuição prévia).
        try {
          const refData = getAffiliateRefData();
          const refCode = refData?.code ?? null;
          if (refCode) {
            const { data: aff } = await supabase
              .from("profiles")
              .select("user_id, affiliate_code")
              .eq("affiliate_code", refCode)
              .maybeSingle();
            if (aff?.user_id && aff.user_id !== activeUserId) {
              const { data: existingProfile } = await supabase
                .from("profiles")
                .select("referred_by_code")
                .eq("user_id", activeUserId)
                .maybeSingle();
              const alreadyAttributed = !!existingProfile?.referred_by_code?.trim();
              if (!alreadyAttributed) {
                await supabase.from("profiles")
                  .update({ referred_by_code: aff.affiliate_code })
                  .eq("user_id", activeUserId);
                await supabase.from("affiliate_referrals").insert({
                  affiliate_user_id: aff.user_id,
                  referred_user_id: activeUserId,
                  referred_email: form.email.trim().toLowerCase(),
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
        } catch (refErr) {
          console.warn("[Checkout] affiliate attribution failed (non-blocking)", refErr);
        }
      }

      // Bug fix: o RPC create_order não recebe e-mail. O e-mail digitado
      // no checkout era jogado fora se o usuário não tinha profile com email.
      // Persistimos no profile (best-effort, não bloqueia o pedido) para
      // que notificações/relatórios admins tenham o contato correto.
      try {
        await (supabase as any)
          .from("profiles")
          .upsert(
            {
              user_id: activeUserId,
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
      // Limpa o rascunho persistido — pedido já foi gravado.
      try { window.sessionStorage.removeItem(FORM_STORAGE_KEY); } catch {}
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-10 pb-32 lg:pb-10">
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
      {(() => {
        const steps = [
          { n: 1, label: "Seus dados", done: buyerDone },
          { n: 2, label: "Entrega", done: addressDone && shippingDone },
          { n: 3, label: "Pagamento", done: paymentDone },
        ];
        // Etapa "ativa" no mobile = primeira não-concluída (ou a última se tudo ok).
        const activeIdx = steps.findIndex((s) => !s.done);
        const activeN = activeIdx === -1 ? steps.length : steps[activeIdx].n;
        return (
          <ol className="mb-5 sm:mb-6 flex items-center gap-1.5 sm:gap-3" aria-label="Progresso do checkout">
            {steps.map((s, i) => {
              const isActive = s.n === activeN;
              return (
              <li key={s.n} className={`flex items-center gap-1.5 sm:gap-3 min-w-0 ${isActive ? "flex-1" : "shrink-0"} sm:flex-1`}>
                <div
                  className={`flex items-center gap-2 min-w-0 flex-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full border transition-colors ${
                    s.done
                      ? "bg-success/10 border-success/30 text-success"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-bold shrink-0 ${
                      s.done ? "bg-success text-success-foreground" : "bg-background border border-border text-foreground"
                    }`}
                    aria-hidden
                  >
                    {s.done ? <Check className="h-3 w-3" strokeWidth={3} /> : s.n}
                  </span>
                  {/* Mobile: só mostra label do passo ativo (evita truncamento feio).
                      Desktop (sm+): sempre mostra todos. */}
                  <span className={`text-[11px] sm:text-xs font-semibold truncate ${isActive ? "inline" : "hidden"} sm:inline`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <span aria-hidden className={`hidden sm:block h-px flex-1 ${s.done ? "bg-success/40" : "bg-border"}`} />
                )}
              </li>
              );
            })}
          </ol>
        );
      })()}

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="checkout-field sm:col-span-2">
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
            </div>
          </section>

          {/* Endereço de Entrega */}
          <section className="checkout-card">
            <h2 className="checkout-section-title">Endereço</h2>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 checkout-field">
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
              {!complementOpen ? (
                <button
                  type="button"
                  onClick={() => setComplementOpen(true)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  + Adicionar complemento
                </button>
              ) : (
                <div className="checkout-field">
                  <label className="checkout-label">Complemento</label>
                  <input
                    value={form.complement}
                    onChange={(e) => setForm({ ...form, complement: e.target.value })}
                    placeholder="Apto 12, Bloco B"
                    className="checkout-input"
                    autoFocus
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 checkout-field">
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

          {/* Entrega — só aparece após CEP/UF preenchidos */}
          {cepReady && (
          <section className="checkout-card space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="checkout-section-title !mb-0">Entrega</h2>
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
          )}

          {/* Forma de Pagamento */}
          <section className="checkout-card">
            <h2 className="checkout-section-title">Pagamento</h2>
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

              const onSelectMethod = (v: "pix" | "credit_card") =>
                setForm((f) => ({ ...f, payment_method: v }));
              return (
                <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {pixOn && (
                    <PaymentOption
                      value="pix"
                      active={form.payment_method === "pix"}
                      onSelect={onSelectMethod}
                      title="PIX"
                      subtitle="Liberação na hora · 5% off"
                      icon={QrCode}
                      badge={pixSaves > 0 ? { text: `Economize ${formatBRL(pixSaves)}`, tone: "secondary" } : { text: "Economize 5%", tone: "secondary" }}
                      totalLabel="Total no PIX"
                      totalValue={pixTotal}
                    />
                  )}
                  {cardOn && (
                    <PaymentOption
                      value="credit_card"
                      active={form.payment_method === "credit_card"}
                      onSelect={onSelectMethod}
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
                {shippingKnown ? formatBRL(shippingValue) : <span className="text-muted-foreground font-normal">Informe o CEP</span>}
              </span>
            </div>
            {insurance > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seguro</span>
                <span className="font-semibold tabular-nums">{formatBRL(insurance)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-success font-semibold">
                <span className="truncate">Cupom {coupon?.code}</span>
                <span className="tabular-nums">−{formatBRL(couponDiscount)}</span>
              </div>
            )}
            {pixDiscount > 0 && (
              <div className="flex justify-between text-success font-semibold">
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
                      setCouponOpen(false);
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
            ) : !couponOpen ? (
              <button
                type="button"
                onClick={() => setCouponOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <Ticket className="w-4 h-4" /> Tem cupom?
              </button>
            ) : (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      className="checkout-input pl-9 uppercase tracking-wider"
                      placeholder="Cupom de desconto"
                      value={couponInput}
                      autoFocus
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={32}
                      onChange={(e) => {
                        // Normaliza no estado, não só no display: remove
                        // espaços (paste com espaço extra é comum) e força
                        // alfanumérico maiúsculo. Garante que o que o
                        // servidor recebe = o que o usuário vê.
                        const cleaned = e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9_-]/g, "");
                        setCouponInput(cleaned);
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
            ref={summaryCtaRef}
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
          {/* Reforços de confiança discretos abaixo do CTA */}
          <div className="mt-3 space-y-2">
            {form.payment_method === "pix" && (
              <p className="text-center text-[11px] text-success font-semibold">
                ✓ Aprovação imediata no PIX
              </p>
            )}
            <div className="flex items-center justify-center gap-3 text-muted-foreground/70">
              <Lock className="w-3 h-3" aria-hidden />
              <span className="text-[10px] font-semibold tracking-wider uppercase">SSL</span>
              <span className="w-px h-3 bg-border" />
              <span className="text-[10px] font-bold tracking-wider">PIX</span>
              <span className="text-[10px] font-bold tracking-wider">VISA</span>
              <span className="text-[10px] font-bold tracking-wider">MASTER</span>
              <span className="text-[10px] font-bold tracking-wider">ELO</span>
            </div>
          </div>
        </aside>

      </form>

      {/* Sticky bottom bar mobile — total + CTA sempre visível.
          Mesmo padrão da página de produto. Só aparece quando há total e
          o CTA do resumo NÃO está visível na tela (evita dois botões
          concorrentes lado a lado). */}
      {grandTotal > 0 && !summaryCtaVisible && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-2 duration-200"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 leading-tight">
              <span className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total</span>
              <span className="block text-lg font-extrabold text-foreground tabular-nums">
                {formatBRL(grandTotal)}
              </span>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                // Foca a primeira seção incompleta para guiar o usuário.
                const target = !buyerDone
                  ? document.querySelector<HTMLInputElement>('input[autocomplete="name"]')
                  : !addressDone
                  ? document.querySelector<HTMLInputElement>('input[autocomplete="postal-code"]')
                  : !shippingDone || !paymentDone
                  ? document.querySelector<HTMLElement>('[data-checkout-payment]') || document.querySelector<HTMLElement>('h2.checkout-section-title')
                  : null;
                if (target) {
                  target.scrollIntoView({ behavior: "smooth", block: "center" });
                  if ((target as HTMLInputElement).focus) setTimeout(() => (target as HTMLInputElement).focus(), 350);
                  return;
                }
                // Tudo pronto → submete o form.
                document.querySelector<HTMLFormElement>('form')?.requestSubmit();
              }}
              className="h-12 px-5 rounded-2xl text-sm font-extrabold bg-success hover:bg-success/90 text-success-foreground shadow-lg shadow-success/30 whitespace-nowrap active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin inline" /> Processando…</>
              ) : (buyerDone && addressDone && shippingDone && paymentDone) ? (
                <>Finalizar pedido</>
              ) : (
                <>Continuar</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
