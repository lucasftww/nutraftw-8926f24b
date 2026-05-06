import { onlyDigits } from "@/lib/utils";
import { isValidCPF } from "@/lib/validators";

export interface CheckoutValidationInput {
  full_name: string;
  email: string;
  cpf: string;
  phone: string;
  zip: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  payment_method: "pix" | "credit_card";
}

export function validateCheckoutForm(
  form: CheckoutValidationInput,
  opts: {
    shippingId: string | null;
    shippingOptionsCount: number;
    pixEnabled: boolean;
    cardEnabled: boolean;
  },
): string | null {
  if (!form.full_name.trim() || form.full_name.trim().split(/\s+/).filter((p) => p.length >= 2).length < 2) {
    return "Informe nome e sobrenome.";
  }
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
    return "Informe um e-mail válido.";
  }
  if (!isValidCPF(form.cpf)) {
    return "CPF inválido. Verifique os números digitados.";
  }
  if (onlyDigits(form.phone).length < 10) {
    return "Telefone inválido.";
  }
  if (onlyDigits(form.zip).length !== 8) {
    return "CEP inválido.";
  }
  if (!form.street.trim() || !form.number.trim() || !form.district.trim()) {
    return "Preencha rua, número e bairro.";
  }
  if (!form.city.trim() || form.state.trim().length !== 2) {
    return "Informe cidade e estado (UF).";
  }
  if (!opts.shippingId) {
    return opts.shippingOptionsCount === 0
      ? "Não há frete disponível para este estado. Entre em contato pelo WhatsApp."
      : "Selecione uma opção de frete.";
  }
  if (!opts.pixEnabled && !opts.cardEnabled) {
    return "Pagamentos temporariamente indisponíveis. Contate o suporte.";
  }
  if (form.payment_method === "pix" && !opts.pixEnabled) {
    return "PIX indisponível. Selecione cartão.";
  }
  if (form.payment_method === "credit_card" && !opts.cardEnabled) {
    return "Cartão indisponível. Selecione PIX.";
  }
  return null;
}
