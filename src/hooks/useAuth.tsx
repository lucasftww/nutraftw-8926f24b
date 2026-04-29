import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "customer" | null;

type AuthValue = {
  session: Session | null;
  user: User | null;
  role: Role;
  loading: boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  // Refs para evitar setState após unmount + invalidar resultados antigos.
  const mountedRef = useRef(true);
  const genRef = useRef(0);
  const currentUidRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchRole(uid: string, myGen: number) {
      if (!mountedRef.current) return;
      setRoleLoading(true);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (!mountedRef.current) return;
      if (myGen !== genRef.current || currentUidRef.current !== uid) return;
      if (error) {
        console.error("[useAuth] fetchRole failed", error);
        setRoleLoading(false);
        return;
      }
      if (data?.some((r: any) => r.role === "admin")) setRole("admin");
      else if (data?.length) setRole("customer");
      else setRole(null);
      setRoleLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mountedRef.current) return;
      genRef.current++;
      const myGen = genRef.current;
      currentUidRef.current = s?.user?.id ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setRoleLoading(true);
        // Defer para evitar chamada síncrona dentro do callback.
        setTimeout(() => fetchRole(s.user.id, myGen), 0);
      } else {
        setRole(null);
        setRoleLoading(false);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!mountedRef.current) return;
        if (genRef.current > 0) return; // onAuthStateChange já cuidou
        genRef.current++;
        const myGen = genRef.current;
        currentUidRef.current = s?.user?.id ?? null;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          setRoleLoading(true);
          fetchRole(s.user.id, myGen);
        }
      })
      .catch((e) => {
        console.error("[useAuth] getSession failed", e);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthValue = {
    session,
    user,
    role,
    loading: loading || roleLoading,
    isAdmin: role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Fallback seguro: nunca lança em HMR/test, retorna estado vazio.
    return {
      session: null,
      user: null,
      role: null,
      loading: true,
      isAdmin: false,
    };
  }
  return ctx;
}
