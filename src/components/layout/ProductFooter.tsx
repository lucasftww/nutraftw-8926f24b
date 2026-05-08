import { MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCurrentProduct } from "@/contexts/CurrentProductContext";
import { formatBRL } from "@/lib/utils";

/**
 * Footer minimalista no estilo "KA Imports": colunas de marca, links úteis
 * e atendimento com CTA WhatsApp em outline verde.
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

  return (
    <footer className="mt-12 sm:mt-16 border-t border-border/60 bg-background">
      <div
        className={`max-w-[1400px] mx-auto px-6 py-10 sm:py-12 sm:pb-12 ${
          current
            ? "pb-[calc(env(safe-area-inset-bottom,0px)+7.5rem)]"
            : "pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          {/* Marca */}
          <div>
            <h3 className="font-display text-xl font-extrabold tracking-tight text-primary uppercase">
              {brandName}
            </h3>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              A sua loja de importados com os melhores preços e garantia de qualidade.
            </p>
          </div>

          {/* Links úteis */}
          <div>
            <h4 className="font-display text-base font-bold text-foreground">
              Links Úteis
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/" className="hover:text-foreground transition-colors">
                  Produtos
                </Link>
              </li>
              <li>
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Suporte
                </a>
              </li>
            </ul>
          </div>

          {/* Atendimento */}
          <div>
            <h4 className="font-display text-base font-bold text-foreground">
              Atendimento
            </h4>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Precisa de ajuda? Fale com nosso suporte diretamente pelo WhatsApp.
            </p>
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(ctaText)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 px-5 h-11 rounded-full border-2 border-whatsapp text-whatsapp font-semibold text-sm hover:bg-whatsapp hover:text-whatsapp-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp focus-visible:ring-offset-2"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              Suporte via WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/60 text-center">
          <p className="text-xs text-muted-foreground">
            © {year} {brandName} — Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}