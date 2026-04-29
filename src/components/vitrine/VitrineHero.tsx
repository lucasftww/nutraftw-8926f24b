import { Instagram } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useActiveBanner } from "@/hooks/useProducts";
import logoImg from "@/assets/vitrine-logo.png";

/**
 * Vitrine hero — usa banner ativo do admin se disponível,
 * caso contrário cai para o layout padrão (logo + bio).
 */
export function VitrineHero() {
  const { data: banner } = useActiveBanner();
  const settings = useSiteSettings();
  const bio = settings.hero_bio || "Produtos farmacêuticos importados com procedência, atendimento direto e envio para todo o Brasil.";

  if (banner && banner.image_url) {
    const hasCta = !!(banner.cta_url && banner.cta_url.trim() && banner.cta_url !== "#");
    const Wrapper: any = hasCta ? "a" : "div";
    const wrapperProps = hasCta
      ? { href: banner.cta_url, ...(/^https?:\/\//i.test(banner.cta_url) ? { target: "_blank", rel: "noreferrer" } : {}) }
      : {};
    return (
      <header className="relative w-full pt-4 sm:pt-6 pb-2">
        <div className="container mx-auto px-5">
          <Wrapper
            {...wrapperProps}
            className="block relative rounded-2xl overflow-hidden shadow-lg"
          >
            <img
              src={banner.image_url}
              alt={banner.title || "Banner"}
              className="w-full aspect-[16/6] sm:aspect-[16/5] object-cover"
              loading="eager"
              decoding="async"
              // @ts-ignore
              fetchpriority="high"
              width={1600}
              height={500}
            />
            {(banner.title || banner.subtitle) && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-5 sm:p-8 text-white">
                {banner.title && <h1 className="text-xl sm:text-3xl font-bold tracking-tight">{banner.title}</h1>}
                {banner.subtitle && <p className="text-sm sm:text-base mt-1 opacity-90">{banner.subtitle}</p>}
                {banner.cta_label && hasCta && (
                  <span className="mt-3 inline-flex w-max items-center px-4 py-2 rounded-full bg-background text-foreground text-sm font-semibold">
                    {banner.cta_label}
                  </span>
                )}
              </div>
            )}
          </Wrapper>
        </div>
      </header>
    );
  }

  return (
    <header className="relative w-full pt-10 sm:pt-16 pb-4">
      <div className="container mx-auto px-5">
        <div className="flex flex-col items-center text-center">
          <span className="relative flex shrink-0 overflow-hidden rounded-full w-24 h-24 sm:w-28 sm:h-28 bg-background">
            <img
              src={logoImg}
              alt="GIMPORTS"
              className="aspect-square h-full w-full object-cover"
            />
          </span>

          <h1 className="mt-5 text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
            GIMPORTS
          </h1>

          <p className="mt-2 text-[13px] sm:text-sm text-muted-foreground max-w-md leading-relaxed">
            {bio}
          </p>

          <a
            href="https://instagram.com/gimports"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="mt-5 inline-flex items-center justify-center h-10 w-10 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            <Instagram className="h-[18px] w-[18px]" />
          </a>
        </div>
      </div>
    </header>
  );
}
