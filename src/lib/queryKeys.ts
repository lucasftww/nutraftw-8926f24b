/**
 * Centralized TanStack Query keys.
 * Always import from here — never hardcode strings in components/hooks.
 */
export const queryKeys = {
  products: {
    all: ["products"] as const,
    active: ["products", "active"] as const,
    detailRoot: ["product"] as const,
    detail: (slug: string) => ["product", slug] as const,
    related: (categoryId: string | null | undefined, excludeId: string | null | undefined) =>
      ["related", categoryId, excludeId] as const,
  },
  categories: {
    all: ["categories"] as const,
  },
  // Cupons e fretes ainda são consultados on-demand no checkout (sem cache),
  // mas centralizamos as keys para que telas futuras (e o invalidate dos admins)
  // sempre usem o mesmo identificador.
  coupons: {
    all: ["coupons"] as const,
  },
  shippingRates: {
    all: ["shipping_rates"] as const,
  },
  siteSettings: {
    all: ["site_settings"] as const,
  },
  wishlist: {
    root: ["wishlist"] as const,
    list: (uid: string | null) => ["wishlist", uid] as const,
  },
} as const;