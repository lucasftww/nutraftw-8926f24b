import { MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCurrentProduct } from "@/contexts/CurrentProductContext";
import { formatBRL } from "@/lib/utils";

/**
 * Footer rico (estilo KA Imports) usado na página de detalhes do produto.
 * 3 blocos: marca + bio, Links Úteis, Atendimento (CTA WhatsApp).
 */
export function ProductFooter() {
  const settings = useSiteSettings();
  const whatsapp = (settings.whatsapp_number || "5511999999999").replace(/\D/g, "");
  const bio =
    settings.footer_bio ||
    settings.hero_bio ||
    "A sua loja de importados com os melhores preços e garantia de qualidade.";
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
  const helperText = current
    ? `Pergunte sobre estoque, prazo de entrega ou desconto para ${current.name}.`
    : "Precisa de ajuda? Fale com nosso suporte diretamente pelo WhatsApp.";

  return (
    <footer className="mt-16 border-t border-border/60 bg-background">
      <div className="max-w-5xl mx-auto px-5 py-10">
        <div className="flex flex-col items-center text-center gap-5">
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(ctaText)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full border border-border text-foreground font-medium text-sm hover:bg-foreground hover:text-background transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
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
            © {year} GIMPORTS
          </p>
        </div>
      </div>
    </footer>
  );
}