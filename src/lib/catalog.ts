import type { ProductRow } from "@/hooks/useProducts";

export const SORT_KEYS = ["categoria", "recentes", "az", "preco_asc", "preco_desc"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  categoria: "Por categoria",
  recentes: "Mais recentes",
  az: "A–Z",
  preco_asc: "Menor preço",
  preco_desc: "Maior preço",
};

export const productScore = (p: ProductRow) => {
  const inStock = (p.stock ?? 0) > 0 ? 1 : 0;
  const featured = p.is_featured ? 1 : 0;
  const recency = new Date(p.created_at).getTime();
  return inStock * 1e15 + featured * 1e13 + recency;
};

export const discountPctOf = (p: ProductRow) => {
  const pr = Number(p.price);
  const sp = p.sale_price != null ? Number(p.sale_price) : 0;
  if (!(sp > 0 && sp < pr)) return 0;
  return (pr - sp) / pr;
};

export const isTirzepatidaCategory = (c: { name?: string | null; slug?: string | null }) => {
  const value = `${c.name ?? ""} ${c.slug ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return value.includes("tirzepatida") || value.includes("tirze") || value.includes("tizer");
};
