import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { ArrowLeft, Home, Search, PackageX } from "lucide-react";

export default function NotFound() {
  const nav = useNavigate();
  useSEO({
    title: "Página não encontrada",
    description: "A página que você procura não existe ou foi movida.",
    canonical: typeof window !== "undefined" ? window.location.origin + "/" : undefined,
  });

  useEffect(() => {
    // Sinaliza para indexadores que essa rota não deve ser indexada.
    const head = document.head;
    const upsertMeta = (selector: string, attrs: Record<string, string>): (() => void) => {
      let el = head.querySelector(selector) as HTMLMetaElement | null;
      const created = !el;
      const prev: Record<string, string | null> = {};
      if (!el) {
        el = document.createElement("meta");
        head.appendChild(el);
      }
      Object.entries(attrs).forEach(([k, v]) => {
        prev[k] = el!.getAttribute(k);
        el!.setAttribute(k, v);
      });
      return () => {
        if (!el) return;
        if (created) {
          el.parentNode?.removeChild(el);
        } else {
          Object.entries(prev).forEach(([k, v]) => {
            if (v === null) el!.removeAttribute(k);
            else el!.setAttribute(k, v);
          });
        }
      };
    };
    const cleanups: Array<() => void> = [];
    cleanups.push(upsertMeta('meta[name="robots"]', { name: "robots", content: "noindex, nofollow" }));
    cleanups.push(upsertMeta('meta[name="googlebot"]', { name: "googlebot", content: "noindex, nofollow" }));
    cleanups.push(upsertMeta('meta[name="prerender-status-code"]', { name: "prerender-status-code", content: "404" }));
    return () => { cleanups.forEach((fn) => fn()); };
  }, []);

  return (
    <section className="container mx-auto px-4 py-16 md:py-24 max-w-2xl text-center animate-in fade-in duration-500">
      {/* Hero ilustrativo — círculo com gradient da marca + ícone pacote */}
      <div className="relative mx-auto h-32 w-32 md:h-40 md:w-40 mb-6">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-gradient-brand opacity-10 animate-pulse"
        />
        <div className="absolute inset-3 rounded-full bg-card border border-border/60 flex items-center justify-center shadow-card">
          <PackageX className="h-12 w-12 md:h-14 md:w-14 text-primary" strokeWidth={1.5} />
        </div>
      </div>

      <h1 className="font-display text-5xl md:text-7xl font-extrabold bg-gradient-brand bg-clip-text text-transparent tracking-tight leading-none">
        404
      </h1>

      <h2 className="mt-3 font-display text-xl md:text-2xl font-bold text-foreground">
        Esse produto sumiu do mapa
      </h2>
      <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
        A página que você procura pode ter sido movida, esgotado ou nunca existiu.
        Mas o catálogo inteiro continua aqui.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-glow active:scale-[0.98] transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Home className="h-4 w-4" strokeWidth={2.25} />
          Ir ao catálogo
        </Link>
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) nav(-1);
            else nav("/", { replace: true });
          }}
          className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full border border-input bg-background font-semibold text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          Voltar
        </button>
      </div>

      <div className="mt-12 pt-8 border-t border-border/40">
        <p className="text-xs text-muted-foreground mb-3">Ou procure direto:</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <Search className="h-4 w-4" strokeWidth={2.25} />
          Buscar no catálogo
        </Link>
      </div>
    </section>
  );
}
