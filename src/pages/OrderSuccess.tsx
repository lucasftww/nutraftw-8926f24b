import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatBRL } from "@/lib/utils";
import { paymentLabel } from "@/lib/orderStatus";
import { Button } from "@/components/ui/button";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import { PostPurchaseRecommendations } from "@/components/account/PostPurchaseRecommendations";
import {
  CheckCircle2,
  Copy,
  Check,
  MessageCircle,
  ShoppingBag,
  ArrowLeft,
  AlertCircle,
  Package,
  ShieldCheck,
} from "lucide-react";

/**
 * Página standalone de pedido confirmado — substitui o modal que abria
 * em /minha-conta?pedido=ID. Vantagens:
 *  - URL compartilhável (deep link em email/WhatsApp)
 *  - Hero celebratório (animação de check, gradient de marca)
 *  - SEO-friendly title ("Pedido #XXXXXX confirmado")
 *  - Mais espaço para PIX em destaque (block grande, não competido)
 *  - CTAs claros: WhatsApp suporte + ver todos pedidos + continuar comprando
 *  - Cross-sell embutido sem competir com a confirmação
 *
 * Realtime: ouve UPDATE no pedido — status passa de pending → paid sem
 * refresh manual (cliente vê a transição ao vivo após PIX confirmado).
 */
export default function OrderSuccess() {
  const { id } = useParams<{ id: string }>();
  const orderId = id || "";
  const settings = useSiteSettings();
  const [order, setOrder] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useSEO({
    title: order
      ? `Pedido #${orderId.slice(0, 8)} confirmado`
      : "Pedido confirmado",
    description: "Acompanhe seu pedido em tempo real.",
    robots: "noindex,follow",
  });

  // Fetch inicial do pedido + itens
  useEffect(() => {
    if (!orderId) {
      setError("ID do pedido ausente.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [{ data: o, error: oErr }, { data: it }] = await Promise.all([
          supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
          supabase.from("order_items").select("*").eq("order_id", orderId),
        ]);
        if (cancelled) return;
        if (oErr) throw oErr;
        if (!o) {
          setError("Pedido não encontrado ou sem permissão de acesso.");
        } else {
          setOrder(o);
          setItems(it || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Erro ao carregar pedido.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  // Realtime: status atualiza ao vivo (ex.: pending → paid após PIX)
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order:${orderId}:success`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder((prev: any) => ({ ...(prev || {}), ...(payload.new || {}) }));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [orderId]);

  // Cleanup do timer do botão "copiado"
  useEffect(() => () => {
    if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
  }, []);

  async function copyPix() {
    if (!order?.payment_copy_paste) return;
    try {
      await navigator.clipboard.writeText(order.payment_copy_paste);
      setCopied(true);
      if (copyTimerRef.current != null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }

  const showPix =
    order &&
    order.payment_method === "pix" &&
    order.status === "pending" &&
    (order.payment_qr_code || order.payment_copy_paste);

  const isPaid = order && ["paid", "processing", "shipped", "delivered"].includes(order.status);

  const whatsappRaw = settings.whatsapp_number?.replace(/\D/g, "") || "";
  const waMessage = order
    ? `Olá! Sobre meu pedido #${orderId.slice(0, 8)} — gostaria de tirar uma dúvida.`
    : "Olá! Preciso de ajuda com meu pedido.";
  const waHref = whatsappRaw
    ? `https://wa.me/${whatsappRaw}?text=${encodeURIComponent(waMessage)}`
    : null;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
        <p className="text-muted-foreground">Carregando pedido…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="font-bold text-foreground mb-1">Não foi possível abrir este pedido</p>
          <p className="text-sm text-muted-foreground mb-5">{error || "Pedido indisponível."}</p>
          <Link
            to="/minha-conta"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-glow transition-colors"
          >
            Ver meus pedidos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="container mx-auto px-4 py-8 sm:py-12 max-w-3xl space-y-6 animate-in fade-in duration-500">
      {/* HERO — check animado + título celebratório */}
      <div className="text-center">
        <div className="relative mx-auto h-20 w-20 sm:h-24 sm:w-24 mb-4">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-success/15 animate-ping opacity-75"
          />
          <div className="absolute inset-0 rounded-full bg-success/10 flex items-center justify-center ring-4 ring-success/20">
            <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-success" strokeWidth={2.25} />
          </div>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
          {isPaid ? "Pedido confirmado!" : "Pedido recebido!"}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          {isPaid
            ? "Seu pagamento foi aprovado. Em breve enviaremos atualizações."
            : showPix
              ? "Falta só o pagamento. Use o QR Code ou o código PIX abaixo."
              : "Acompanhe o status abaixo."}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
          <Package className="h-3.5 w-3.5" />
          #{orderId.slice(0, 8)}
          <span className="text-muted-foreground/60">·</span>
          {new Date(order.created_at).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* TIMELINE */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <OrderTimeline status={order.status} />
      </div>

      {/* PIX em destaque (se aplicável) */}
      {showPix && (
        <section className="rounded-2xl border-2 border-success/40 bg-success/5 p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-success text-white text-sm font-extrabold shrink-0">
              PIX
            </span>
            <div className="min-w-0">
              <h2 className="font-bold text-base sm:text-lg text-success leading-tight">
                Pague para liberar o pedido
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Escaneie o QR Code ou copie o código no app do seu banco.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-[auto_1fr] gap-4 sm:gap-5 items-start">
            {order.payment_qr_code && (
              <div className="flex justify-center bg-white rounded-xl p-3 mx-auto">
                <img
                  src={order.payment_qr_code}
                  alt="QR Code PIX"
                  width={200}
                  height={200}
                  className="w-[200px] h-[200px] object-contain"
                />
              </div>
            )}
            <div className="space-y-3 min-w-0">
              {order.payment_copy_paste && (
                <div className="space-y-2">
                  <div className="text-2xs uppercase tracking-wide font-semibold text-muted-foreground">
                    PIX copia e cola
                  </div>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={order.payment_copy_paste}
                      aria-label="Código PIX para copiar e colar"
                      className="flex-1 min-w-0 px-3 py-2 text-xs bg-background border border-border rounded-lg font-mono truncate"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      type="button"
                      onClick={copyPix}
                      className="shrink-0 bg-success hover:bg-success/90 text-white"
                    >
                      {copied ? <><Check className="h-4 w-4 mr-1" /> Copiado</> : <><Copy className="h-4 w-4 mr-1" /> Copiar</>}
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Após o pagamento o status atualiza automaticamente — esta página
                se atualiza sozinha.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* RESUMO — items + totais */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">
          Itens do pedido
        </h2>
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 text-sm">
              <img
                src={it.product_image_url || "/assets/no-image.svg"}
                alt={it.product_name}
                loading="lazy"
                decoding="async"
                width={56}
                height={56}
                className="w-14 h-14 rounded-lg object-contain p-1 bg-white border border-border shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium line-clamp-2 leading-snug">{it.product_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {it.quantity}× {formatBRL(it.unit_price)}
                </p>
              </div>
              <p className="font-semibold tabular-nums shrink-0">{formatBRL(it.subtotal)}</p>
            </li>
          ))}
        </ul>

        {/* Totais */}
        <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
          {(() => {
            const sub = Number(order.subtotal || 0);
            const ship = Number(order.shipping || 0);
            const ins = Number(order.insurance || 0);
            const disc = Number(order.discount || 0);
            const total = Number(order.total || 0);
            const beforePix = sub + ship + ins - disc;
            const pixDisc = order.payment_method === "pix" ? Math.max(0, beforePix - total) : 0;
            return (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatBRL(sub)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Frete</span><span className="tabular-nums">{formatBRL(ship)}</span></div>
                {ins > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Seguro</span><span className="tabular-nums">{formatBRL(ins)}</span></div>}
                {disc > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Cupom{order.coupon_code ? ` (${order.coupon_code})` : ""}</span>
                    <span className="tabular-nums">− {formatBRL(disc)}</span>
                  </div>
                )}
                {pixDisc > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Desconto PIX (5%)</span>
                    <span className="tabular-nums">− {formatBRL(pixDisc)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-base pt-2 mt-1 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary tabular-nums">{formatBRL(total)}</span>
                </div>
                <p className="text-2xs text-muted-foreground pt-1.5">
                  Pagamento: {paymentLabel(order.payment_method)}
                </p>
              </>
            );
          })()}
        </div>
      </section>

      {/* ENDEREÇO */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 text-sm">
        <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Endereço de entrega
        </h2>
        <div className="text-foreground/90 space-y-0.5">
          <p className="font-semibold">{order.shipping_full_name}</p>
          <p>{order.shipping_street}, {order.shipping_number}{order.shipping_complement ? ` — ${order.shipping_complement}` : ""}</p>
          <p>{order.shipping_district} — {order.shipping_city}/{order.shipping_state}</p>
          <p className="text-muted-foreground">CEP: {order.shipping_zip} · Tel: {order.shipping_phone}</p>
        </div>
      </section>

      {/* RECOMENDAÇÕES — cross-sell */}
      {items.length > 0 && <PostPurchaseRecommendations items={items} />}

      {/* CTAs */}
      <div className={`grid gap-2 ${waHref ? "sm:grid-cols-2" : ""}`}>
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl bg-whatsapp text-whatsapp-foreground font-semibold text-sm hover:bg-whatsapp-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp focus-visible:ring-offset-2"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
            Falar no WhatsApp
          </a>
        )}
        <Link
          to="/minha-conta"
          className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl border border-input bg-background font-semibold text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <ShoppingBag className="h-4 w-4" strokeWidth={2.25} />
          Meus pedidos
        </Link>
      </div>

      <div className="text-center pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Continuar comprando
        </Link>
      </div>

      {/* TRUST FOOTER */}
      <div className="text-center pt-4 border-t border-border/40">
        <p className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Pagamento processado com segurança · SSL/TLS
        </p>
      </div>
    </section>
  );
}
