import { useEffect, useState } from "react";

/**
 * Barra slim acima do header — gatilhos de conversão visíveis "ao vivo":
 * frete grátis, desconto PIX, cupom de boas-vindas. Mensagens rotacionam
 * a cada 5s com indicadores discretos (dots).
 *
 * ⚠️ NÃO é dismissível: em ticket alto (R$ 200-2000), perder o gatilho de
 * "frete grátis acima de R$ 800" porque o usuário fechou uma vez na vida
 * é queima de conversão recorrente. A barra é slim (32px) e não invade
 * a UX. Persistência removida.
 *
 * Em mobile, ocupa 32px (h-8) — economia de 4px vs antes (era h-9 = 36px).
 * Em desktop continua h-9 para presença visual.
 */
const MESSAGES = [
  { text: "Frete GRÁTIS acima de R$ 800", emoji: "🚚" },
  { text: "5% OFF no PIX em todos os produtos", emoji: "💰" },
  { text: "Use BEMVINDO10 e ganhe 10% na 1ª compra", emoji: "🎁" },
];

const ROTATE_MS = 5000;

export function AnnouncementBar() {
  const [idx, setIdx] = useState(0);

  // Rotação automática das mensagens. Pausa quando aba perde foco para
  // não estourar setInterval em background.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIdx((i) => (i + 1) % MESSAGES.length);
      }
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="relative bg-primary text-primary-foreground"
      role="region"
      aria-label="Avisos da loja"
    >
      <div className="mx-auto flex h-8 md:h-9 max-w-[1400px] items-center justify-center gap-2 px-4 text-center">
        <p
          key={idx}
          className="text-[12px] sm:text-[13px] font-medium tracking-tight truncate animate-in fade-in slide-in-from-bottom-1 duration-500"
          aria-live="polite"
          aria-atomic="true"
        >
          <span aria-hidden className="mr-1.5">{MESSAGES[idx].emoji}</span>
          {MESSAGES[idx].text}
        </p>
      </div>
      {/* Indicadores discretos — confirma que há rotação e permite previsão.
          Em mobile (<sm) escondemos os dots para preservar verticalidade. */}
      <div
        className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1"
        aria-hidden="true"
      >
        {MESSAGES.map((_, i) => (
          <span
            key={i}
            className={`h-1 w-1 rounded-full transition-all duration-300 ${
              i === idx
                ? "bg-primary-foreground w-3"
                : "bg-primary-foreground/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
