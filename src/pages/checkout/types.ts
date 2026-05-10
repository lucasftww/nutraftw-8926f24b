import type { FieldStatus } from "@/lib/validators";

export type CheckoutFormState = {
  full_name: string; email: string; cpf: string; phone: string;
  zip: string; street: string; number: string; complement: string;
  district: string; city: string; state: string; notes: string;
  payment_method: "pix" | "credit_card";
};

export const EMPTY_FORM: CheckoutFormState = {
  full_name: "", email: "", cpf: "", phone: "",
  zip: "", street: "", number: "", complement: "",
  district: "", city: "", state: "", notes: "",
  payment_method: "pix",
};

export type { FieldStatus };
