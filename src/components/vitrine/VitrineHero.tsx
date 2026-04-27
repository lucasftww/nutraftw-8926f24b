import { Link } from "react-router-dom";
import { ShoppingBag, Instagram, MapPin } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import logoImg from "@/assets/vitrine-logo.png";

/**
 * Vitrine hero — sem capa de perfil.
 * Logo circular + nome + bio + 3 botões circulares.
 */
export function VitrineHero() {
  const { count, openCart } = useCart();

  return (
    <header className="relative w-full pt-6">
      <div className="container mx-auto px-5">
        <div className="flex flex-col items-center">
          {/* Logo bubble */}
          <span className="relative flex shrink-0 overflow-hidden rounded-full w-32 h-32 sm:w-40 sm:h-40 border-4 border-background bg-background shadow-lg">
            <img
              src={logoImg}
              alt="GIMPORTS"
              className="aspect-square h-full w-full object-cover"
            />
          </span>

          {/* Brand name */}
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-center text-foreground tracking-tight">
            GIMPORTS
          </h1>

          {/* Bio */}
          <p className="mt-4 text-center text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed px-2">
            ✨ Sua parceira no cuidado com a saúde ⚖️ Produtos que auxiliam no emagrecimento 💊 Medicamentos, suplementos e vitaminas 🤝 Atendimento de confiança 📲 Fale conosco e saiba mais!
          </p>

          {/* Action buttons */}
          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={openCart}
              aria-label="Abrir carrinho"
              className="relative inline-flex items-center justify-center h-14 w-14 rounded-full border border-input bg-background shadow-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-success px-1 text-[10px] font-bold text-success-foreground ring-2 ring-background">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>

            <a
              href="https://instagram.com/gimports"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Seguir GIMPORTS no Instagram"
              className="inline-flex items-center justify-center h-14 w-14 rounded-full border border-input bg-background shadow-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Instagram className="h-5 w-5" />
            </a>

            <Link
              to="/login"
              aria-label="Acesso da conta"
              className="inline-flex items-center justify-center h-14 w-14 rounded-full border border-input bg-background shadow-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <MapPin className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6" />
    </header>
  );
}
