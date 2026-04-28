import { Instagram } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import logoImg from "@/assets/vitrine-logo.png";

/**
 * Vitrine hero — usa banner ativo do admin se disponível,
 * caso contrário cai para o layout padrão (logo + bio).
 */
export function VitrineHero() {
  const [banner, setBanner] = useState<any | null>(null);
  const settings = useSiteSettings();
  const bio = settings.hero_bio || "✨ Sua parceira no cuidado com a saúde ⚖️ Produtos que auxiliam no emagrecimento 💊 Medicamentos, suplementos e vitaminas 🤝 Atendimento de confiança 📲 Fale conosco e saiba mais!";

  useEffect(() => {
    (supabase as any)
      .from("site_banners")
      .select("*")
      .eq("active", true)
      .order("display_order")
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => setBanner(data || null));
  }, []);

  if (banner && banner.image_url) {
    return (
      <header className="relative w-full pt-4 sm:pt-6 pb-2">
        <div className="container mx-auto px-5">
          <a
            href={banner.cta_url || "#"}
            className="block relative rounded-2xl overflow-hidden shadow-lg group"
          >
            <img
              src={banner.image_url}
              alt={banner.title || "Banner"}
              className="w-full aspect-[16/6] sm:aspect-[16/5] object-cover transition-transform group-hover:scale-105"
            />
            {(banner.title || banner.subtitle) && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-5 sm:p-8 text-white">
                {banner.title && <h1 className="text-xl sm:text-3xl font-bold tracking-tight">{banner.title}</h1>}
                {banner.subtitle && <p className="text-sm sm:text-base mt-1 opacity-90">{banner.subtitle}</p>}
                {banner.cta_label && (
                  <span className="mt-3 inline-flex w-max items-center px-4 py-2 rounded-full bg-background text-foreground text-sm font-semibold">
                    {banner.cta_label}
                  </span>
                )}
              </div>
            )}
          </a>
        </div>
      </header>
    );
  }

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
            {bio}
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
