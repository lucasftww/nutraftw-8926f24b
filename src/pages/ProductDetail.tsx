import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";

export default function ProductDetail() {
  const { slug } = useParams();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const { add, openCart } = useCart();

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("products")
      .select("*, category:categories(name, slug)")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        setP(data);
        setLoading(false);
      });
  }, [slug]);

  if (loading) return <div className="container py-20 text-center text-muted-foreground">A carregar…</div>;
  if (!p)
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground mb-4">Produto não encontrado.</p>
        <Button asChild variant="outline">
          <Link to="/">Voltar ao catálogo</Link>
        </Button>
      </div>
    );

  return (
    <div className="container py-8 md:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
        <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        <div className="aspect-square rounded-2xl border border-border bg-muted/30 overflow-hidden">
          <img src={p.image_url || "/assets/no-image.svg"} alt={p.name} className="w-full h-full object-cover" />
        </div>

        <div>
          {p.category && (
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">{p.category.name}</span>
          )}
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-foreground mt-2 mb-4">
            {p.name}
          </h1>
          <p className="font-display text-4xl font-extrabold text-primary mb-6">{formatBRL(p.price)}</p>

          {p.description && <p className="text-muted-foreground mb-6 leading-relaxed">{p.description}</p>}

          <div className="space-y-3 mb-6 text-sm">
            {p.active_principle && (
              <div className="flex gap-2">
                <span className="font-bold text-foreground min-w-[140px]">Princípio ativo:</span>
                <span className="text-muted-foreground">{p.active_principle}</span>
              </div>
            )}
            {p.composition && (
              <div className="flex gap-2">
                <span className="font-bold text-foreground min-w-[140px]">Composição:</span>
                <span className="text-muted-foreground">{p.composition}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-3 bg-background border-2 border-border rounded-full p-1">
              <button
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
                onClick={() => setQty(Math.max(1, qty - 1))}
              >
                −
              </button>
              <span className="font-bold w-6 text-center">{qty}</span>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
                onClick={() => setQty(qty + 1)}
              >
                +
              </button>
            </div>
            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                add(
                  {
                    product_id: p.id,
                    slug: p.slug,
                    name: p.name,
                    price: Number(p.price),
                    image_url: p.image_url,
                  },
                  qty
                );
                openCart();
              }}
            >
              Adicionar ao carrinho
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
