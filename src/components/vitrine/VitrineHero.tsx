import { ShieldCheck, Truck, Lock } from "lucide-react";
import { useActiveBanner } from "@/hooks/useProducts";

/**
 * Vitrine hero — usa banner ativo do admin se disponível,
 * caso contrário cai para o layout padrão (logo + bio).
 */
export function VitrineHero() {
  const { data: banner } = useActiveBanner();

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
    // Vitrine direta ao ponto (sem banner). Headline + sublinha + 3 micro-provas.
    // Sem logo gigante: o cliente já está aqui pra ver produtos, não a marca.
    <header className="relative w-full pt-7 sm:pt-12 pb-3">
      <div className="container mx-auto px-5">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-[1.15]">
            Farmacêuticos importados, originais.
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
            Envio para todo o Brasil. Suporte direto no WhatsApp.
          </p>

          <ul className="mt-5 flex items-center justify-center gap-x-5 gap-y-2 flex-wrap text-[12px] sm:text-[13px] text-muted-foreground">
            {[
              { icon: ShieldCheck, label: "Procedência verificada" },
              { icon: Truck, label: "Envio nacional" },
              { icon: Lock, label: "Pagamento seguro" },
            ].map((b) => (
              <li key={b.label} className="inline-flex items-center gap-1.5">
                <b.icon className="h-3.5 w-3.5 text-primary/80" strokeWidth={1.75} />
                <span className="font-medium text-foreground/80">{b.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </header>
  );
}
