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
  stock: number;
  created_at: string;
  category: { id: string; name: string; slug: string } | null;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
}

const PRODUCT_COLUMNS =
  "id, slug, name, description, price, sale_price, image_url, is_featured, stock, created_at, category:categories(id, name, slug)";

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
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
  });
}

export function useProductBySlug(slug: string | undefined) {
  return useQuery<any | null>({
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
      return data;
    },
  });
}

export function useRelatedProducts(categoryId: string | undefined, excludeId: string | undefined) {
  return useQuery<any[]>({
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
      return (data as any) || [];
    },
  });
}

export function useActiveBanner() {
  return useQuery<any | null>({
    queryKey: queryKeys.banners.active,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_banners")
        .select("*")
        .eq("active", true)
        .order("display_order")
        .limit(1)
        .maybeSingle();
      if (error) {
        // Tabela pode não existir em ambientes antigos — degrade silenciosa
        return null;
      }
      return data || null;
    },
  });
}