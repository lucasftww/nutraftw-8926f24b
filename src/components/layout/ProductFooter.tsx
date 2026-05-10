import { MessageCircle, ShieldCheck, Truck, CreditCard, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCurrentProduct } from "@/contexts/CurrentProductContext";
import { formatBRL } from "@/lib/utils";

/**
 * Footer com trust signals fortes — peptídeos premium têm ticket alto (R$ 200-2000)
 * e o usuário precisa de reasseguramento legal/operacional antes de comprar.
 *
 * Estrutura:
 *  - Linha de selos de confiança (envio, segurança, atendimento, troca)
 *  - 4 colunas (Marca, Atendimento, Políticas, Pagamento)
 *  - Bandeiras de pagamento + selo SSL
 *  - CNPJ/endereço/horário (exigência CDC + gatilho de confiança)
 *  - Copyright
 */
export function ProductFooter() {
  const settings = useSiteSettings();
  const whatsapp = (settings.whatsapp_number || "5511999999999").replace(/\D/g, "");
  const year = new Date().getFullYear();
  const { current } = useCurrentProduct();

  const productUrl =
    current && typeof window !== "undefined"
      ? `${window.location.origin}/produto/${current.slug}`
      : "";
  const ctaText = current
    ? `Olá! Tenho interesse no produto *${current.name}*${
        current.price ? ` (${formatBRL(current.price)})` : ""
      }.${productUrl ? `\nLink: ${productUrl}` : ""}\nPode me ajudar?`
    : "Olá! Preciso de suporte.";

  const brandName = settings.brand_name || "Royal Vitta";
  const cnpj = settings.brand_cnpj || "";
  const address = settings.brand_address || "";
  const businessHours = settings.business_hours || "Atendimento Seg–Sex 9h às 18h";

  return (
    <footer className="mt-12 sm:mt-16 border-t border-border/60 bg-background">
      <div
        className={`max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 ${
          current
            ? "pb-[calc(env(safe-area-inset-bottom,0px)+7.5rem)]"
            : "pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
        }`}
      >
        {/* ===== Trust signals — destaque acima de tudo ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10 pb-8 border-b border-border/60">
          <TrustItem
            icon={ShieldCheck}
            title="100% Seguro"
            desc="Pagamento criptografado"
          />
          <TrustItem
            icon={Truck}
            title="Envio nacional"
            desc="Para todo o Brasil"
          />
          <TrustItem
            icon={CreditCard}
            title="PIX 5% OFF"
            desc="ou cartão em até 3x"
          />
          <TrustItem
            icon={RefreshCcw}
            title="Procedência"
            desc="Produtos originais"
          />
        </div>

        {/* ===== Grid principal ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Marca */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-display text-xl font-extrabold tracking-tight text-primary uppercase">
              {brandName}
            </h3>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Sua loja de produtos premium importados, com procedência garantida e
              entrega nacional.
            </p>
          </div>

          {/* Atendimento */}
          <FooterColumn title="Atendimento">
            <FooterLink
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(ctaText)}`}
              external
            >
              WhatsApp
            </FooterLink>
            <FooterLink to="/minha-conta">Minha conta</FooterLink>
            <FooterLink to="/minha-conta">Meus pedidos</FooterLink>
            <FooterLink to="/favoritos">Favoritos</FooterLink>
          </FooterColumn>

          {/* Institucional */}
          <FooterColumn title="Institucional">
            <FooterLink to="/sobre">Sobre nós</FooterLink>
            <FooterLink to="/">Catálogo</FooterLink>
            <FooterLink to="/instalar">App / Instalar</FooterLink>
          </FooterColumn>

          {/* CTA WhatsApp + bandeiras */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="font-display text-base font-bold text-foreground">
              Suporte rápido
            </h4>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Dúvidas pré-compra? Fale conosco no WhatsApp.
            </p>
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(ctaText)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 px-5 h-11 rounded-full bg-whatsapp text-whatsapp-foreground font-semibold text-sm hover:bg-whatsapp-hover active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp focus-visible:ring-offset-2"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              Falar no WhatsApp
            </a>
            <p className="mt-3 text-[11px] text-muted-foreground/80 leading-relaxed">
              {businessHours}
            </p>
          </div>
        </div>

        {/* ===== Métodos de pagamento + selo SSL ===== */}
        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success shrink-0" aria-hidden />
            <span>Site protegido — SSL/TLS</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <PaymentBadge label="PIX" tone="success" />
            <PaymentBadge label="Visa" />
            <PaymentBadge label="Master" />
            <PaymentBadge label="Elo" />
            <PaymentBadge label="Hipercard" />
            <PaymentBadge label="Boleto" />
          </div>
        </div>

        {/* ===== Identificação legal (CDC + trust) ===== */}
        {(cnpj || address) && (
          <p className="mt-6 text-[11px] text-muted-foreground/80 leading-relaxed text-center">
            {brandName}
            {cnpj ? ` · CNPJ ${cnpj}` : ""}
            {address ? ` · ${address}` : ""}
          </p>
        )}

        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            © {year} {brandName} — Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}

function TrustItem({
  icon: Icon, title, desc,
}: { icon: typeof ShieldCheck; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
      <div className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold leading-tight">{title}</p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-display text-base font-bold text-foreground">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">{children}</ul>
    </div>
  );
}

function FooterLink({
  to, href, external, children,
}: {
  to?: string; href?: string; external?: boolean; children: React.ReactNode;
}) {
  const className = "inline-flex items-center min-h-[36px] hover:text-foreground transition-colors";
  if (external && href) {
    return (
      <li>
        <a href={href} target="_blank" rel="noreferrer" className={className}>
          {children}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link to={to || "#"} className={className}>{children}</Link>
    </li>
  );
}

function PaymentBadge({ label, tone }: { label: string; tone?: "success" }) {
  return (
    <span
      className={`inline-flex items-center h-7 px-2.5 rounded-md border text-[11px] font-bold tracking-wide ${
        tone === "success"
          ? "bg-success/10 text-success border-success/30"
          : "bg-card text-foreground/70 border-border"
      }`}
    >
      {label}
    </span>
  );
}
