import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  is_featured: boolean;
  is_new_release?: boolean;
  is_on_offer?: boolean;
  active_principle?: string | null;
  composition?: string | null;
  offer_order?: number;
  stock: number;
  created_at: string;
  category: { id: string; name: string; slug: string } | null;
  brand: { id: string; name: string; slug: string } | null;
}

/**
 * Versão completa do produto — retornada por useProductBySlug (select *).
 * Diferença de ProductRow: brand não é join (só brand_id), category é join
 * restrito (name, slug sem id).
 */
export interface ProductDetailRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  is_featured: boolean;
  is_new_release?: boolean | null;
  is_on_offer?: boolean | null;
  active_principle?: string | null;
  composition?: string | null;
  offer_order?: number | null;
  stock: number;
  created_at: string;
  updated_at?: string | null;
  display_order?: number | null;
  is_active?: boolean | null;
  category_id?: string | null;
  brand_id?: string | null;
  /** URL do vídeo do produto (YouTube embed, etc.). */
  video_url?: string | null;
  /** Join de categoria: apenas name e slug (sem id). */
  category: { name: string; slug: string } | null;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
}

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
}

// Colunas usadas no CATÁLOGO (lista). Otimização: removidos `active_principle`
// e `composition` que NÃO são usados na listagem nem na busca — só aparecem
// na página do produto, que carrega tudo via useProductBySlug. Antes essa
// query trazia ~30% de payload extra a cada visita à home.
// `description` é mantido porque é usado na busca textual do catálogo.
const PRODUCT_COLUMNS =
  "id, slug, name, description, price, sale_price, image_url, is_featured, is_new_release, is_on_offer, offer_order, stock, created_at, category:categories(id, name, slug), brand:brands(id, name, slug)";

export function useCategories() {
  return useQuery<CategoryRow[]>({
    queryKey: queryKeys.categories.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .order("display_order");
      if (error) throw error;
      return (data as any) || [];
    },
    // Categorias mudam raramente — staleTime alto evita refetch a cada
    // navegação entre páginas que usam useCategories (catálogo, drawer
    // de filtros). Antes ele refetcha a cada mount.
    staleTime: 5 * 60_000, // 5 minutos
  });
}

export function useBrands() {
  return useQuery<BrandRow[]>({
    queryKey: ["brands", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug")
        .order("display_order")
        .order("name");
      if (error) throw error;
      return (data as any) || [];
    },
    staleTime: 5 * 60_000, // Marcas mudam raramente.
  });
}

export function useProducts() {
  return useQuery<ProductRow[]>({
    queryKey: queryKeys.products.active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("is_active", true)
        .order("is_on_offer", { ascending: false })
        .order("offer_order", { ascending: true })
        .order("is_featured", { ascending: false })
        // Ordem manual definida pelo admin (drag-and-drop em /admin/products)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
    // Produtos podem mudar (estoque, preço, promoção), mas não tão
    // frequentemente. 2 minutos = saldo entre dados frescos e performance.
    // Antes refetcha a cada navegação para a home (ex.: voltar do produto).
    staleTime: 2 * 60_000,
  });
}

export function useProductBySlug(slug: string | undefined) {
  return useQuery<ProductDetailRow | null>({
    enabled: !!slug,
    queryKey: queryKeys.products.detail(slug ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(name, slug)")
        .eq("slug", slug!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      // Cast necessário: Supabase infere tipo interno que não bate 1:1 com
      // nossa interface, mas os campos são estruturalmente compatíveis.
      return data as ProductDetailRow | null;
    },
    // Alinha com o staleTime usado em prefetchProduct() no Catálogo:
    // se a página de detalhe for aberta logo após o prefetch, reaproveita o
    // cache em vez de refetch imediato.
    staleTime: 60_000,
  });
}

export interface RelatedProductRow {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
}

export function useRelatedProducts(categoryId: string | undefined, excludeId: string | undefined) {
  return useQuery<RelatedProductRow[]>({
    enabled: !!categoryId && !!excludeId,
    queryKey: queryKeys.products.related(categoryId, excludeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, price, sale_price, image_url")
        .eq("is_active", true)
        .eq("category_id", categoryId!)
        .neq("id", excludeId!)
        .limit(4);
      if (error) throw error;
      return (data as RelatedProductRow[]) || [];
    },
    staleTime: 2 * 60_000,
  });
}
