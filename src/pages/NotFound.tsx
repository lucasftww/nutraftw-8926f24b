import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";

export default function NotFound() {
  useSEO({
    title: "Página não encontrada — GIMPORTS",
    description: "A página que você procura não existe ou foi movida.",
  });
  useEffect(() => {
    // Sinaliza para indexadores que essa rota não deve ser indexada
    let el = document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const prev = el?.getAttribute("content") ?? null;
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", "robots");
      document.head.appendChild(el);
    }
    el.setAttribute("content", "noindex, nofollow");
    return () => {
      if (!el) return;
      if (prev) el.setAttribute("content", prev);
      else el.parentNode?.removeChild(el);
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
