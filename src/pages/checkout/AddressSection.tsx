import { useState } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { maskCEP } from "@/lib/utils";
import { useFieldValidation } from "@/hooks/useFieldValidation";
import { validateCEP } from "@/lib/validators";
import { FieldHint } from "./FieldHint";
import type { CheckoutFormState } from "./types";

interface AddressSectionProps {
  form: CheckoutFormState;
  setForm: React.Dispatch<React.SetStateAction<CheckoutFormState>>;
  cepLoading: boolean;
}

export function AddressSection({ form, setForm, cepLoading }: AddressSectionProps) {
  const [complementOpen, setComplementOpen] = useState<boolean>(false);
  const vCEP = useFieldValidation(form.zip, validateCEP, { debounceMs: 200 });

  return (
    <section className="checkout-card">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-extrabold tabular-nums shrink-0">2</span>
        <h2 className="checkout-section-title !mb-0">Endereço</h2>
      </div>
      <div className="space-y-4">
        <div className="checkout-field">
          <label htmlFor="co-zip" className="checkout-label">CEP *</label>
          <div className="relative">
            <input
              id="co-zip"
              required
              value={form.zip}
              onChange={(e) => setForm((f) => ({ ...f, zip: maskCEP(e.target.value) }))}
              onBlur={vCEP.touch}
              placeholder="00000-000"
              inputMode="numeric"
              maxLength={9}
              className="checkout-input pr-10"
              data-status={vCEP.status === "idle" ? undefined : vCEP.status}
              aria-invalid={vCEP.status === "invalid"}
              aria-describedby={vCEP.status === "invalid" ? "co-zip-hint" : "co-zip-help"}
              autoComplete="postal-code"
            />
            {cepLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
            )}
          </div>
          {vCEP.status === "invalid" ? (
            <FieldHint id="co-zip-hint" status="invalid" message={vCEP.message} />
          ) : (
            <p id="co-zip-help" className="text-xs text-muted-foreground ml-1 mt-1.5">
              Digite o CEP para preenchimento automático do endereço
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 checkout-field">
            <label htmlFor="co-street" className="checkout-label">Rua / Logradouro *</label>
            <input
              id="co-street"
              required
              value={form.street}
              onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
              placeholder="Rua das Flores"
              className="checkout-input"
              autoComplete="address-line1"
              maxLength={120}
            />
          </div>
          <div className="checkout-field">
            <label htmlFor="co-number" className="checkout-label">Número *</label>
            <input
              id="co-number"
              required
              value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              placeholder="123"
              className="checkout-input"
              autoComplete="address-line2"
              inputMode="numeric"
              maxLength={20}
            />
          </div>
        </div>
        <div className="checkout-field">
          <label htmlFor="co-district" className="checkout-label">Bairro *</label>
          <input
            id="co-district"
            required
            value={form.district}
            onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
            placeholder="Centro"
            className="checkout-input"
            autoComplete="address-level3"
            maxLength={80}
          />
        </div>
        {!complementOpen ? (
          <button
            type="button"
            onClick={() => setComplementOpen(true)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            + Adicionar complemento
          </button>
        ) : (
          <div className="checkout-field">
            <div className="flex items-center justify-between">
              <label htmlFor="co-complement" className="checkout-label">Complemento</label>
              {/* Antes não dava pra fechar o campo depois de aberto. */}
              <button
                type="button"
                onClick={() => { setForm((f) => ({ ...f, complement: "" })); setComplementOpen(false); }}
                className="text-[11px] font-semibold text-muted-foreground hover:text-destructive"
              >
                remover
              </button>
            </div>
            <input
              id="co-complement"
              value={form.complement}
              onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))}
              placeholder="Apto 12, Bloco B"
              className="checkout-input"
              autoComplete="address-line3"
              maxLength={80}
              autoFocus
            />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 checkout-field">
            <label htmlFor="co-city" className="checkout-label">Cidade *</label>
            <input
              id="co-city"
              required
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="São Paulo"
              className="checkout-input"
              autoComplete="address-level2"
              maxLength={80}
            />
          </div>
          <div className="checkout-field">
            <label htmlFor="co-state" className="checkout-label">Estado *</label>
            <div className="relative">
              <select
                id="co-state"
                required
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                className="checkout-input bg-white appearance-none cursor-pointer pr-10"
                autoComplete="address-level1"
              >
                <option value="">UF</option>
                {[
                  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
                  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
                ].map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
              <ChevronDown
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
