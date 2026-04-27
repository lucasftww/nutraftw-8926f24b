import { Link } from "react-router-dom";
import { ShoppingBag, Instagram, MessageCircle, ShieldCheck } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import heroImg from "@/assets/vitrine-hero.jpg";
import logoImg from "@/assets/vitrine-logo.png";

/**
 * Vitrine-style hero shown on the home page.
 * Inspired by VitrineTurbo: rounded cover banner + centered circular brand
 * + name + bio + circular action icons.
 */
export function VitrineHero() {
  const { count, openCart } = useCart();

  return (
    <header className="relative w-full">
      {/* Cover */}
      <div className="px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="relative mx-auto max-w-3xl">
          <div className="relative w-full overflow-hidden rounded-[36px] sm:rounded-[52px] aspect-[16/9] sm:aspect-[1530/520] shadow-[var(--shadow-card)]">
            <img
              src={heroImg}
              alt="GIMPORTS Pharmacy — vitrine"
              className="h-full w-full object-cover"
              fetchPriority="high"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-foreground/5 to-transparent" />

            {/* Floating admin/account quick-link, very subtle */}
            <Link
              to="/login"
              aria-label="Acesso da conta"
              className="absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/85 backdrop-blur text-foreground shadow-sm hover:bg-background transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
          </div>

          {/* Logo bubble overlapping the cover */}
          <div className="relative -mt-12 sm:-mt-16 flex justify-center">
            <div className="rounded-full bg-background p-1.5 shadow-[0_8px_28px_-8px_hsl(var(--foreground)/0.25)] ring-1 ring-border/60">
              <div className="h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-full bg-background flex items-center justify-center">
                <img
                  src={logoImg}
                  alt="GIMPORTS"
                  className="h-full w-full object-contain p-1"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brand info */}
      <div className="mx-auto mt-3 sm:mt-4 max-w-xl px-6 text-center">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          GIMPORTS
        </h1>
        <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-muted-foreground">
          ✨ Sua parceira no cuidado com a saúde ⚖️ Produtos que auxiliam no emagrecimento
          💊 Medicamentos, suplementos e vitaminas 🤝 Atendimento de confiança 📲 Fale conosco
          e saiba mais!
        </p>
      </div>

      {/* Circular action row */}
      <nav
        aria-label="Ações rápidas"
        className="mx-auto mt-5 mb-6 flex max-w-xs items-center justify-center gap-4"
      >
        <button
          onClick={openCart}
          aria-label="Abrir carrinho"
          className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-background ring-1 ring-border/70 text-foreground hover:ring-primary/40 hover:text-primary transition-colors shadow-sm"
        >
          <ShoppingBag className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>

        <a
          href="https://instagram.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-background ring-1 ring-border/70 text-foreground hover:ring-primary/40 hover:text-primary transition-colors shadow-sm"
        >
          <Instagram className="h-5 w-5" />
        </a>

        <a
          href="https://wa.me/5511999999999"
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-background ring-1 ring-border/70 text-foreground hover:ring-[#25D366]/50 hover:text-[#25D366] transition-colors shadow-sm"
        >
          <MessageCircle className="h-5 w-5" />
        </a>
      </nav>
    </header>
  );
}
