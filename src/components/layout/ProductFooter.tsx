import { MessageCircle, ShieldCheck, Truck, Lock } from "lucide-react";
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
    <footer className="mt-12 border-t border-border bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="space-y-8">
          {/* Marca + bio */}
          <div>
            <h3 className="font-display text-xl font-extrabold tracking-tight text-primary">
              GIMPORTS
            </h3>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md">
              {bio}
            </p>
          </div>

          {/* Links Úteis */}
          <div>
            <h4 className="text-sm font-bold text-foreground mb-3">Links Úteis</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-primary hover:underline">
                  Produtos
                </Link>
              </li>
              <li>
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Suporte
                </a>
              </li>
              <li>
                <Link to="/sobre" className="text-primary hover:underline">
                  Sobre
                </Link>
              </li>
            </ul>
          </div>

          {/* Atendimento */}
          <div>
            <h4 className="text-sm font-bold text-foreground mb-3">Atendimento</h4>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-md">
              {helperText}
            </p>
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(ctaText)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 h-12 rounded-full border-2 border-[#25D366] text-[#25D366] font-semibold text-sm hover:bg-[#25D366] hover:text-white transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {ctaLabel}
            </a>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border text-center">
          {/* Selos de confiança discretos */}
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-4 text-xs text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Produtos originais
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-primary" /> Envio para todo o Brasil
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-primary" /> Pagamento seguro
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            © {year} GIMPORTS · Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}