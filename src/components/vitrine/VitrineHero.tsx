import { Link } from "react-router-dom";
import { ShoppingBag, Instagram, MessageCircle, ShieldCheck } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import heroImg from "@/assets/vitrine-hero.jpg";
import logoImg from "@/assets/vitrine-logo.png";

/**
 * Vitrine-style hero shown on the home page.
 * Mobile-first: rounded cover banner + overlapping circular logo
 * + brand name + bio + circular action icons.
 */
export function VitrineHero() {
  const { count, openCart } = useCart();

  return (
    <header className="relative w-full pt-3 sm:pt-4">
      {/* Cover */}
      <div className="px-3 sm:px-5">
        <div className="relative mx-auto max-w-3xl">
          <div className="relative w-full overflow-hidden rounded-[32px] sm:rounded-[44px] aspect-[16/9] sm:aspect-[1530/520] ring-1 ring-border/40 shadow-[0_10px_40px_-12px_hsl(var(--foreground)/0.18)]">
            <img
              src={heroImg}
              alt="GIMPORTS — vitrine premium"
              className="h-full w-full object-cover"
              fetchPriority="high"
              decoding="async"
            />
            {/* soft bottom gradient for logo readability */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/70 via-background/20 to-transparent" />

            <Link
              to="/login"
              aria-label="Acesso da conta"
              className="absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 backdrop-blur text-foreground shadow-sm hover:bg-background transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
          </div>

          {/* Logo bubble overlapping the cover */}
          <div className="relative -mt-14 sm:-mt-16 flex justify-center">
            <div className="rounded-full bg-background p-2 shadow-[0_12px_32px_-8px_hsl(var(--foreground)/0.25)] ring-1 ring-border/60">
              <div className="h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-full bg-background flex items-center justify-center">
                <img
                  src={logoImg}
                  alt="GIMPORTS"
                  className="h-[78%] w-[78%] object-contain"
                  loading="eager"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brand info */}
      <div className="mx-auto mt-4 max-w-md px-6 text-center">
        <h1 className="font-display text-[26px] sm:text-3xl font-extrabold tracking-tight text-foreground">
          GIMPORTS
        </h1>
        <p className="mx-auto mt-2.5 max-w-[34ch] text-[13.5px] sm:text-sm leading-relaxed text-muted-foreground">
          ✨ Sua parceira no cuidado com a saúde · 💊 Medicamentos, suplementos e vitaminas
          · 🤝 Atendimento de confiança
        </p>
      </div>

      {/* Circular action row */}
      <nav
        aria-label="Ações rápidas"
        className="mx-auto mt-5 flex w-full items-center justify-center gap-4"
      >
        <button
          onClick={openCart}
          aria-label="Abrir carrinho"
          className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-background ring-1 ring-border text-foreground hover:ring-primary/50 hover:text-primary transition-all shadow-sm hover:shadow-md"
        >
          <ShoppingBag className="h-[18px] w-[18px]" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground ring-2 ring-background">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>

        <a
          href="https://instagram.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-background ring-1 ring-border text-foreground hover:ring-primary/50 hover:text-primary transition-all shadow-sm hover:shadow-md"
        >
          <Instagram className="h-[18px] w-[18px]" />
        </a>

        <a
          href="https://wa.me/5511999999999"
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-background ring-1 ring-border text-foreground hover:ring-success/60 hover:text-success transition-all shadow-sm hover:shadow-md"
        >
          <MessageCircle className="h-[18px] w-[18px]" />
        </a>
      </nav>
    </header>
  );
}
