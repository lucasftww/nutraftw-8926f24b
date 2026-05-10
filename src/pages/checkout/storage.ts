import { EMPTY_FORM } from "./types";
import type { CheckoutFormState } from "./types";

export const FORM_STORAGE_KEY = "checkout:form:v1";

export function loadPersistedForm(): CheckoutFormState {
  if (typeof window === "undefined") return EMPTY_FORM;
  try {
    const raw = window.sessionStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return EMPTY_FORM;
    const parsed = JSON.parse(raw) as Partial<CheckoutFormState>;
    return { ...EMPTY_FORM, ...parsed };
  } catch {
    return EMPTY_FORM;
  }
}
