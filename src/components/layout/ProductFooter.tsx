import { MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";

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
              Precisa de ajuda? Fale com nosso suporte diretamente pelo WhatsApp.
            </p>
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
                "Olá! Preciso de suporte."
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 h-12 rounded-full border-2 border-[#25D366] text-[#25D366] font-semibold text-sm hover:bg-[#25D366] hover:text-white transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Suporte via WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © {year} GIMPORTS · Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}