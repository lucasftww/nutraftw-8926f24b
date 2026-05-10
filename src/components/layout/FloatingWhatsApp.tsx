import { MessageCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCurrentProduct } from "@/contexts/CurrentProductContext";
import { formatBRL } from "@/lib/utils";

/**
 * Botão WhatsApp flutuante (FAB) — obrigatório em e-commerce BR.
 *
 * No header mobile o WhatsApp ficava escondido (`hidden md:inline-flex`),
 * forçando o usuário a abrir o drawer e rolar até o rodapé. Em loja farma
 * de ticket alto (peptídeos), dúvida pré-compra é frequente — esconder
 * o canal #1 de suporte queima leads.
 *
 * Comportamento:
 *  - Sobe acima da barra "Comprar agora" sticky em páginas de produto.
 *  - Respeita safe-area iOS.
 *  - Oculto no /checkout (foco total na conversão, sem distrações).
 *  - Pré-preenche mensagem com nome/preço do produto quando relevante.
 */
export function FloatingWhatsApp() {
  const location = useLocation();
  const settings = useSiteSettings();
  const { current } = useCurrentProduct();

  // Esconde no checkout — fluxo crítico não pode ter distração lateral.
  if (location.pathname === "/checkout") return null;

  const wa = (settings.whatsapp_number || "").replace(/\D/g, "");
  if (wa.length < 10) return null; // sem número configurado, não renderiza

  const productUrl =
    current && typeof window !== "undefined"
      ? `${window.location.origin}/produto/${current.slug}`
      : "";
  const defaultMsg =
    settings.whatsapp_message ||
    "Olá! Estou no site e preciso de ajuda com um produto.";
  const productMsg = current
    ? `Olá! Tenho interesse no produto *${current.name}*${
        current.price ? ` (${formatBRL(current.price)})` : ""
      }.${productUrl ? `\nLink: ${productUrl}` : ""}\nPode me ajudar?`
    : defaultMsg;

  const href = `https://wa.me/${wa}?text=${encodeURIComponent(productMsg)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com suporte no WhatsApp"
      className={`fixed right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-elegant hover:bg-whatsapp-hover hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-whatsapp/40 ${
        // Em mobile (<sm), sobe acima da sticky bar de produto (se houver).
        // Em desktop (sm+), a sticky bar some (sm:hidden), então fica em 1rem.
        current
          ? "bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] sm:bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
          : "bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
      }`}
    >
      <MessageCircle className="h-7 w-7" strokeWidth={2} />
      {/* Pulse sutil — chama o olho sem ser invasivo. */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-whatsapp/40 animate-ping opacity-50 pointer-events-none"
      />
    </a>
  );
}
