import { useEffect, useRef, useState } from "react";
import { Truck, Loader2, MapPin, AlertCircle, PackageCheck } from "lucide-react";
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

  // Guards contra race conditions (auto-cálculo no onChange pode disparar
  // várias buscas concorrentes) e setState após desmontagem.
  const reqIdRef = useRef(0);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const formatZip = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  async function calculate(zipRaw: string) {
    const cleanZip = zipRaw.replace(/\D/g, "");
    if (cleanZip.length !== 8) return;
    // Cancela request anterior em voo e marca esta como a corrente.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const myId = ++reqIdRef.current;
    const isStale = () => myId !== reqIdRef.current || !mountedRef.current;

    setLoading(true); setError(null); setOpts([]); setCity(""); setState("");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cleanZip}/json/`, { signal: ctrl.signal });
      const data = await r.json();
      if (isStale()) return;
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
      if (isStale()) return;
      const arr = (rates as ShippingOption[]) || [];
      setOpts(arr);
      if (arr.length === 0) setError("Sem opções de frete para este estado");
    } catch (e: any) {
      if (e?.name === "AbortError" || isStale()) return;
      setError("Não foi possível calcular agora");
    } finally {
      if (!isStale()) setLoading(false);
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
          <p className="text-[11px] text-muted-foreground leading-tight">Entregamos para todo o Brasil — informe seu CEP</p>
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
            placeholder="00000-000"
            aria-label="CEP"
            aria-invalid={!!error}
            className={`w-full h-11 rounded-xl border bg-background pl-9 pr-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 transition-colors ${error ? "border-destructive/60 focus-visible:ring-destructive/30" : "border-input focus-visible:ring-primary/30 focus-visible:border-primary/40"}`}
          />
        </div>
        <button
          type="button"
          onClick={() => calculate(zip)}
          disabled={loading || zip.replace(/\D/g, "").length !== 8}
          className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm hover:bg-primary-glow disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center min-w-[92px] active:scale-95 transition-all"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calcular"}
        </button>
      </div>
      <a
        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
        target="_blank"
        rel="noreferrer"
        className="inline-block mt-1.5 text-[11px] text-muted-foreground hover:text-primary hover:underline underline-offset-2"
      >
        Não sei meu CEP
      </a>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-destructive animate-fade-in">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {loading && opts.length === 0 && !error && (
        <ul className="mt-3 space-y-1.5" aria-busy="true" aria-label="Calculando frete">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-background border border-border">
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 rounded skeleton-shimmer" />
                <div className="h-2.5 w-1/3 rounded skeleton-shimmer" />
              </div>
              <div className="h-3.5 w-14 rounded skeleton-shimmer" />
            </li>
          ))}
        </ul>
      )}

      {opts.length > 0 && (
        <div className="mt-3 animate-fade-in">
          {city && state && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
              <PackageCheck className="h-3 w-3 text-success" />
              Entrega para <span className="font-semibold text-foreground">{city}/{state}</span>
            </p>
          )}
          <ul className="space-y-1.5">
            {opts.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-background border border-border hover:border-primary/30 transition-colors">
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
                <span className={`text-sm font-extrabold tabular-nums shrink-0 ${Number(o.price) === 0 ? "text-success" : "text-primary"}`}>
                  {Number(o.price) === 0 ? "Grátis" : formatBRL(Number(o.price))}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-muted-foreground">Prazo a partir da confirmação do pagamento.</p>
        </div>
      )}
    </div>
  );
}