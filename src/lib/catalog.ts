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

/**
 * Retorna as informações de preço calculadas de um produto.
 * Centraliza a lógica para evitar discrepâncias entre Catálogo, Detalhe e Checkout.
 */
export const getProductPricing = (p: { price: number | string; sale_price?: number | string | null }) => {
  const price = Number(p.price);
  const salePrice = p.sale_price != null ? Number(p.sale_price) : 0;
  
  // Promoção real: preço de oferta deve ser menor que o original e maior que zero.
  // Consideramos apenas se o desconto for de pelo menos 1% para evitar ruído visual.
  const rawDiscount = price > 0 ? (price - salePrice) / price : 0;
  const discountPct = (salePrice > 0 && salePrice < price && rawDiscount >= 0.01) 
    ? Math.round(rawDiscount * 100) 
    : 0;
  
  const hasSale = discountPct > 0;
  const finalPrice = hasSale ? salePrice : price;
  const savings = hasSale ? price - salePrice : 0;
  
  return {
    basePrice: price,
    salePrice: hasSale ? salePrice : null,
    finalPrice,
    discountPct,
    hasSale,
    savings,
    pixPrice: finalPrice * 0.95 // 5% de desconto no PIX padrão
  };
};

/** @deprecated Use getProductPricing().discountPct */
export const discountPctOf = (p: ProductRow) => {
  return getProductPricing(p).discountPct / 100;
};

export const isTirzepatidaCategory = (c: { name?: string | null; slug?: string | null }) => {
  const value = `${c.name ?? ""} ${c.slug ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return value.includes("tirzepatida") || value.includes("tirze") || value.includes("tizer");
};
