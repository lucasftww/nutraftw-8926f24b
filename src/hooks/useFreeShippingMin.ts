import { useSiteSettings } from "@/hooks/useSiteSettings";

/**
 * Threshold de frete grátis (em R$). Fonte única de verdade — substitui
 * o valor hardcoded que estava em 2 lugares (CartDrawer + AnnouncementBar).
 *
 * Lê de `site_settings.free_shipping_min` (gravado pelo admin); cai no
 * fallback FALLBACK quando a chave não existe ou está vazia.
 *
 * Retorna número >= 0. Valores não-numéricos / negativos viram o fallback.
 */
const FALLBACK = 800;

export function useFreeShippingMin(): number {
  const settings = useSiteSettings();
  const raw = settings.free_shipping_min;
  if (!raw) return FALLBACK;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return FALLBACK;
  return n;
}
