import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Wishlist (lista de desejos) por usuário autenticado.
 * - `ids` em forma de Set para checagem O(1) nos cards.
 * - `toggle(productId)` adiciona ou remove com optimistic update.
 * - Quando deslogado, retorna conjunto vazio e o toggle redireciona para login.
 */
export function useWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id ?? null;

  const query = useQuery<string[]>({
    queryKey: queryKeys.wishlist.list(uid),
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("wishlists")
        .select("product_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as { product_id: string }[]) || []).map((r) => r.product_id);
    },
  });

  // Memoiza o Set para preservar referência entre renders quando os dados não mudam,
  // evitando re-renders em massa em componentes que dependem de `ids` (Catalog, Cards).
  const ids = useMemo(() => new Set(query.data ?? []), [query.data]);

  const toggleMut = useMutation({
    mutationFn: async (productId: string) => {
      if (!uid) throw new Error("not-authenticated");
      const isFav = ids.has(productId);
      if (isFav) {
        const { error } = await (supabase as any)
          .from("wishlists")
          .delete()
          .eq("user_id", uid)
          .eq("product_id", productId);
        if (error) throw error;
        return { productId, added: false };
      }
      const { error } = await (supabase as any)
        .from("wishlists")
        .insert({ user_id: uid, product_id: productId });
      if (error) throw error;
      return { productId, added: true };
    },
    onMutate: async (productId) => {
      await qc.cancelQueries({ queryKey: queryKeys.wishlist.list(uid) });
      const prev = qc.getQueryData<string[]>(queryKeys.wishlist.list(uid)) ?? [];
      const next = prev.includes(productId)
        ? prev.filter((i) => i !== productId)
        : [productId, ...prev];
      qc.setQueryData(queryKeys.wishlist.list(uid), next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.wishlist.list(uid), ctx.prev);
      toast.error("Não foi possível atualizar seus favoritos");
    },
    onSuccess: (r) => {
      toast.success(r.added ? "Adicionado aos favoritos" : "Removido dos favoritos");
    },
  });

  return {
    ids,
    isLoading: query.isLoading,
    isAuthed: !!uid,
    toggle: (productId: string) => toggleMut.mutate(productId),
    isPending: toggleMut.isPending,
  };
}