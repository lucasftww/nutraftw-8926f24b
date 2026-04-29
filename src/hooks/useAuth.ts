import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "customer" | null;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    // Guard que invalida resultados obsoletos. Usamos uma "geração" que é
    // incrementada a cada evento — isso protege tanto o fetchRole quanto a
    // resposta do getSession() (que pode chegar DEPOIS de um onAuthStateChange).
    let gen = 0;
    let currentUid: string | null = null;

    async function fetchRole(uid: string, myGen: number) {
      setRoleLoading(true);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (error) {
        console.error("[useAuth] fetchRole failed", error);
        if (myGen === gen && currentUid === uid) setRoleLoading(false);
        return;
      }
      if (myGen !== gen || currentUid !== uid) return; // sessão mudou enquanto buscávamos
      if (data?.some((r: any) => r.role === "admin")) setRole("admin");
      else if (data?.length) setRole("customer");
      else setRole(null);
      setRoleLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      gen++;
      setSession(s);
      setUser(s?.user ?? null);
      currentUid = s?.user?.id ?? null;
      if (s?.user) {
        const myGen = gen;
        setRoleLoading(true);
        setTimeout(() => fetchRole(s.user.id, myGen), 0);
      } else {
        setRole(null);
        setRoleLoading(false);
      }
    });
    // Sempre liberar o loading, mesmo se o getSession falhar (rede, CORS,
    // etc.) — caso contrário RequireAuth fica preso em "Carregando…".
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        // Se o onAuthStateChange já disparou enquanto esperávamos pelo
        // getSession, ignore — ele tem a verdade mais recente.
        if (gen > 0) return;
        gen++;
        setSession(s);
        setUser(s?.user ?? null);
        currentUid = s?.user?.id ?? null;
        if (s?.user) {
          setRoleLoading(true);
          fetchRole(s.user.id, gen);
        }
      })
      .catch((e) => {
        console.error("[useAuth] getSession failed", e);
      })
      .finally(() => {
        setLoading(false);
      });
    return () => sub.subscription.unsubscribe();
  }, []);

  // loading combinado: ainda resolvendo se a sessão OU o role estiverem em vôo.
  // Sem isso, RequireAuth pode ver isAdmin=false antes do fetchRole completar e redirecionar.
  return {
    session,
    user,
    role,
    loading: loading || roleLoading,
    isAdmin: role === "admin",
  };
}
