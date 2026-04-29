import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";

export default function NotFound() {
  useSEO({
    title: "Página não encontrada — GIMPORTS",
    description: "A página que você procura não existe ou foi movida.",
  });
  useEffect(() => {
    // Sinaliza para indexadores que essa rota não deve ser indexada.
    // Não mexemos em window.history para preservar o botão "Voltar".
    const head = document.head;

    // helper para upsert + restauração de uma meta tag
    const upsertMeta = (
      selector: string,
      attrs: Record<string, string>,
    ): (() => void) => {
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
    // Robots: noindex, nofollow (consistente para todos os crawlers)
    cleanups.push(upsertMeta('meta[name="robots"]', { name: "robots", content: "noindex, nofollow" }));
    cleanups.push(upsertMeta('meta[name="googlebot"]', { name: "googlebot", content: "noindex, nofollow" }));
    // Hint para serviços de prerender (prerender.io etc.) retornarem 404 real
    cleanups.push(upsertMeta('meta[name="prerender-status-code"]', { name: "prerender-status-code", content: "404" }));

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);
  return (
    <div className="container py-32 text-center">
      <h1 className="font-display text-6xl font-extrabold text-primary mb-3">404</h1>
      <p className="text-muted-foreground mb-6">Página não encontrada.</p>
      <Link to="/" className="text-primary font-semibold hover:underline">← Voltar ao catálogo</Link>
    </div>
  );
}
