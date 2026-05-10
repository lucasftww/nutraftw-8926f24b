import { maskCPF, maskPhone } from "@/lib/utils";
import { useFieldValidation } from "@/hooks/useFieldValidation";
import { validateFullName, validateEmail, validatePhoneBR, validateCPF } from "@/lib/validators";
import { FieldHint } from "./FieldHint";
import type { CheckoutFormState } from "./types";

interface BuyerSectionProps {
  form: CheckoutFormState;
  setForm: React.Dispatch<React.SetStateAction<CheckoutFormState>>;
}

export function BuyerSection({ form, setForm }: BuyerSectionProps) {
  const vName = useFieldValidation(form.full_name, validateFullName);
  const vEmail = useFieldValidation(form.email, validateEmail);
  const vPhone = useFieldValidation(form.phone, validatePhoneBR);
  const vCPF = useFieldValidation(form.cpf, validateCPF);

  return (
    <section className="checkout-card">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-extrabold tabular-nums shrink-0">1</span>
        <h2 className="checkout-section-title !mb-0">Seus dados</h2>
      </div>
      <div className="space-y-4">
        <div className="checkout-field">
          <label htmlFor="co-name" className="checkout-label">Nome Completo *</label>
          <input
            id="co-name"
            required
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            onBlur={vName.touch}
            placeholder="João da Silva"
            className="checkout-input"
            data-status={vName.status === "idle" ? undefined : vName.status}
            aria-invalid={vName.status === "invalid"}
            aria-describedby={vName.status !== "idle" ? "co-name-hint" : undefined}
            autoComplete="name"
            maxLength={100}
          />
          <FieldHint id="co-name-hint" status={vName.status} message={vName.message} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="checkout-field sm:col-span-2">
            <label htmlFor="co-email" className="checkout-label">E-mail *</label>
            <input
              id="co-email"
              required
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              onBlur={vEmail.touch}
              placeholder="joao@exemplo.com"
              className="checkout-input"
              data-status={vEmail.status === "idle" ? undefined : vEmail.status}
              aria-invalid={vEmail.status === "invalid"}
              aria-describedby={vEmail.status !== "idle" ? "co-email-hint" : undefined}
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={255}
            />
            <FieldHint id="co-email-hint" status={vEmail.status} message={vEmail.message} />
          </div>
          <div className="checkout-field">
            <label htmlFor="co-phone" className="checkout-label">Telefone (WhatsApp) *</label>
            <input
              id="co-phone"
              required
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))}
              onBlur={vPhone.touch}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              className="checkout-input"
              data-status={vPhone.status === "idle" ? undefined : vPhone.status}
              aria-invalid={vPhone.status === "invalid"}
              aria-describedby={vPhone.status !== "idle" ? "co-phone-hint" : undefined}
              autoComplete="tel"
              maxLength={15}
            />
            <FieldHint id="co-phone-hint" status={vPhone.status} message={vPhone.message} />
          </div>
          <div className="checkout-field">
            <label htmlFor="co-cpf" className="checkout-label">CPF *</label>
            <input
              id="co-cpf"
              required
              value={form.cpf}
              onChange={(e) => setForm((f) => ({ ...f, cpf: maskCPF(e.target.value) }))}
              onBlur={vCPF.touch}
              placeholder="000.000.000-00"
              inputMode="numeric"
              className="checkout-input"
              data-status={vCPF.status === "idle" ? undefined : vCPF.status}
              aria-invalid={vCPF.status === "invalid"}
              aria-describedby={vCPF.status !== "idle" ? "co-cpf-hint" : undefined}
              autoComplete="off"
              maxLength={14}
            />
            <FieldHint id="co-cpf-hint" status={vCPF.status} message={vCPF.message} />
          </div>
        </div>
      </div>
    </section>
  );
}
