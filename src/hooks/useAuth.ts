import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "customer" | null;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guard que invalida resultados de fetchRole obsoletos quando o usuário
    // troca/desloga antes do fetch retornar (evita "voltar" para role antigo).
    let currentUid: string | null = null;

    async function fetchRole(uid: string) {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (error) {
        console.error("[useAuth] fetchRole failed", error);
        return;
      }
      if (currentUid !== uid) return; // outra sessão chegou enquanto buscávamos
      if (data?.some((r: any) => r.role === "admin")) setRole("admin");
      else if (data?.length) setRole("customer");
      else setRole(null);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      currentUid = s?.user?.id ?? null;
      if (s?.user) {
        setTimeout(() => fetchRole(s.user.id), 0);
      } else {
        setRole(null);
      }
    });
    // Sempre liberar o loading, mesmo se o getSession falhar (rede, CORS,
    // etc.) — caso contrário RequireAuth fica preso em "Carregando…".
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        currentUid = s?.user?.id ?? null;
        if (s?.user) fetchRole(s.user.id);
      })
      .catch((e) => {
        console.error("[useAuth] getSession failed", e);
      })
      .finally(() => {
        setLoading(false);
      });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, role, loading, isAdmin: role === "admin" };
}
