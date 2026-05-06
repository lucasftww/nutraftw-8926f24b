import { MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCurrentProduct } from "@/contexts/CurrentProductContext";
import { formatBRL } from "@/lib/utils";

/**
 * Footer minimalista — CTA WhatsApp + links + copyright.
 */
export function ProductFooter() {
  const settings = useSiteSettings();
  const whatsapp = (settings.whatsapp_number || "5511999999999").replace(/\D/g, "");
  const year = new Date().getFullYear();
  const { current } = useCurrentProduct();

  // CTA dinâmico: muda texto e mensagem se houver um produto sendo visto.
  const productUrl =
    current && typeof window !== "undefined"
      ? `${window.location.origin}/produto/${current.slug}`
      : "";
  const ctaLabel = current ? "Tirar dúvida no WhatsApp" : "Falar no WhatsApp";
  const ctaText = current
    ? `Olá! Tenho interesse no produto *${current.name}*${
        current.price ? ` (${formatBRL(current.price)})` : ""
      }.${productUrl ? `\nLink: ${productUrl}` : ""}\nPode me ajudar?`
    : "Olá! Preciso de suporte.";

  return (
    <footer className="mt-12 sm:mt-16 border-t border-border/60 bg-muted/30">
      <div className="max-w-5xl mx-auto px-5 py-8 sm:py-10 pb-[calc(env(safe-area-inset-bottom,0px)+7.5rem)] sm:pb-10">
        <div className="flex flex-col items-center text-center gap-4 sm:gap-5">
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(ctaText)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full bg-whatsapp text-whatsapp-foreground font-semibold text-sm shadow-sm hover:bg-whatsapp-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp focus-visible:ring-offset-2"
          >
            <MessageCircle className="w-4 h-4" aria-hidden />
            {ctaLabel}
          </a>

          <nav className="flex items-center gap-6 text-[13px] text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              Produtos
            </Link>
            <Link to="/sobre" className="hover:text-foreground transition-colors">
              Sobre
            </Link>
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Suporte
            </a>
          </nav>

          <p className="text-[11px] text-muted-foreground/80">
            © {year} <span className="font-brand font-bold tracking-[0.18em] uppercase">Royal Vita</span>
          </p>
        </div>
      </div>
    </footer>
  );
}