import { useState } from "react";
import { Truck, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";

interface ShippingOption {
  id: string;
  label: string;
  price: number;
  delivery_days_min: number | null;
  delivery_days_max: number | null;
}

/**
 * Calculadora de frete no detalhe do produto.
 * Reduz o atrito de descobrir o frete só no checkout (principal motivo de abandono).
 */
export function ShippingCalculator() {
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [opts, setOpts] = useState<ShippingOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatZip = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  async function calculate(zipRaw: string) {
    const cleanZip = zipRaw.replace(/\D/g, "");
    if (cleanZip.length !== 8) return;
    setLoading(true); setError(null); setOpts([]); setCity(""); setState("");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cleanZip}/json/`);
      const data = await r.json();
      if (data?.erro || !data?.uf) {
        setError("CEP não encontrado");
        return;
      }
      setCity(data.localidade || "");
      setState(data.uf);
      const { data: rates } = await (supabase as any)
        .from("shipping_rates")
        .select("id, label, price, delivery_days_min, delivery_days_max")
        .eq("state", data.uf)
        .eq("active", true)
        .order("price");
      const arr = (rates as ShippingOption[]) || [];
      setOpts(arr);
      if (arr.length === 0) setError("Sem opções de frete para este estado");
    } catch {
      setError("Não foi possível calcular agora");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center">
          <Truck className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground leading-tight">Calcule o frete</h3>
          <p className="text-[11px] text-muted-foreground leading-tight">Receba em casa em todo o Brasil</p>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            inputMode="numeric"
            value={zip}
            onChange={(e) => {
              const v = formatZip(e.target.value);
              setZip(v);
              if (v.replace(/\D/g, "").length === 8) calculate(v);
            }}
            placeholder="Digite seu CEP"
            aria-label="CEP"
            className="w-full h-11 rounded-xl border border-input bg-background pl-9 pr-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40"
          />
        </div>
        <button
          type="button"
          onClick={() => calculate(zip)}
          disabled={loading || zip.replace(/\D/g, "").length !== 8}
          className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 inline-flex items-center justify-center min-w-[80px]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calcular"}
        </button>
      </div>
      <a
        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
        target="_blank"
        rel="noreferrer"
        className="block mt-1.5 text-[11px] text-muted-foreground hover:text-primary"
      >
        Não sei meu CEP
      </a>

      {error && <p className="mt-3 text-xs font-semibold text-destructive">{error}</p>}

      {opts.length > 0 && (
        <div className="mt-3">
          {city && state && (
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Entrega para <span className="font-semibold text-foreground">{city}/{state}</span>
            </p>
          )}
          <ul className="space-y-1.5">
            {opts.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-background border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight truncate">{o.label}</p>
                  {(o.delivery_days_min || o.delivery_days_max) && (
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {o.delivery_days_min && o.delivery_days_max
                        ? `${o.delivery_days_min}–${o.delivery_days_max} dias úteis`
                        : `Até ${o.delivery_days_max ?? o.delivery_days_min} dias úteis`}
                    </p>
                  )}
                </div>
                <span className="text-sm font-extrabold text-primary tabular-nums shrink-0">
                  {Number(o.price) === 0 ? "Grátis" : formatBRL(Number(o.price))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}