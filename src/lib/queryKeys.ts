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
  banners: {
    all: ["site_banners"] as const,
    active: ["site_banners", "active"] as const,
  },
} as const;