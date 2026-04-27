import { Instagram } from "lucide-react";
import logoImg from "@/assets/vitrine-logo.png";

/**
 * Vitrine hero — sem capa de perfil.
 * Layout limpo, centralizado: logo + nome + bio + Instagram.
 */
export function VitrineHero() {
  return (
    <header className="relative w-full pt-8 sm:pt-12 pb-2">
      <div className="container mx-auto px-5">
        <div className="flex flex-col items-center text-center">
          {/* Logo bubble */}
          <span className="relative flex shrink-0 overflow-hidden rounded-full w-32 h-32 sm:w-40 sm:h-40 border-4 border-background bg-background shadow-lg">
            <img
              src={logoImg}
              alt="GIMPORTS"
              className="aspect-square h-full w-full object-cover"
            />
          </span>

          {/* Brand name */}
          <h1 className="mt-5 text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            GIMPORTS
          </h1>

          {/* Bio */}
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
            ✨ Sua parceira no cuidado com a saúde ⚖️ Produtos que auxiliam no emagrecimento 💊 Medicamentos, suplementos e vitaminas 🤝 Atendimento de confiança 📲 Fale conosco e saiba mais!
          </p>

          {/* Action button */}
          <div className="mt-6 flex items-center justify-center">
            <a
              href="https://instagram.com/gimports"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Seguir GIMPORTS no Instagram"
              className="inline-flex items-center justify-center h-14 w-14 rounded-full border border-input bg-background shadow-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Instagram className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
