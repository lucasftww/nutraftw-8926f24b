import { MessageCircle, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCurrentProduct } from "@/contexts/CurrentProductContext";
import { formatBRL } from "@/lib/utils";

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
    <footer className="mt-8 sm:mt-12 border-t border-border/60 bg-background">
      <div
        className={`max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 ${
          current
            ? "pb-[calc(env(safe-area-inset-bottom,0px)+7.5rem)]"
            : "pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
        }`}
      >
        {/* ===== Grid principal ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Marca — nome com gradient da logo (navy → cyan). */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-display text-xl font-extrabold tracking-tight uppercase bg-gradient-brand bg-clip-text text-transparent">
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

        {/* ===== Selo SSL ===== */}
        <div className="mt-10 pt-6 border-t border-border/60 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success shrink-0" aria-hidden />
          <span>Site protegido — SSL/TLS</span>
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
  // min-h-[44px] atende WCAG 2.5.5 (tap target mínimo 44×44px) — antes
  // estava em 36px, abaixo do mínimo, dificultando o toque no mobile.
  const className = "inline-flex items-center min-h-[44px] py-1 hover:text-foreground transition-colors";
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

