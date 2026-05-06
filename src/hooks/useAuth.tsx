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

// ───────── Cache de role em sessionStorage ─────────
// Evita refazer o SELECT em user_roles a cada reload de página.
// TTL curto (5 min) garante que mudanças de role propaguem rápido.
// Indexado por user_id para nunca confundir sessões.
const ROLE_CACHE_KEY = "auth.role.cache.v1";
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

type RoleCacheEntry = { uid: string; role: Role; at: number };

function readRoleCache(uid: string): Role | null {
  try {
    const raw = sessionStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as RoleCacheEntry;
    if (entry.uid !== uid) return null;
    if (Date.now() - entry.at > ROLE_CACHE_TTL_MS) return null;
    return entry.role;
  } catch {
    return null;
  }
}

function writeRoleCache(uid: string, role: Role) {
  try {
    const entry: RoleCacheEntry = { uid, role, at: Date.now() };
    sessionStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // sessionStorage indisponível (modo privado, etc.) — apenas ignora.
  }
}

function clearRoleCache() {
  try {
    sessionStorage.removeItem(ROLE_CACHE_KEY);
  } catch {
    // noop
  }
}

type AuthValue = {
  session: Session | null;
  user: User | null;
  role: Role;
  loading: boolean;
  /** True só enquanto a sessão inicial é restaurada. NÃO bloqueia em role. */
  authLoading: boolean;
  /** True enquanto o role está sendo buscado pela primeira vez (sem cache). */
  roleLoading: boolean;
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

    async function fetchRole(uid: string, myGen: number, hadCache: boolean) {
      if (!mountedRef.current) return;
      // Se já hidratamos do cache, revalida em background sem mostrar loading
      // — evita flash de "Carregando…" entre páginas.
      if (!hadCache) setRoleLoading(true);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (!mountedRef.current) return;
      if (myGen !== genRef.current || currentUidRef.current !== uid) return;
      if (error) {
        console.error("[useAuth] fetchRole failed", error);
        if (!hadCache) setRoleLoading(false);
        return;
      }
      const roleRows = (data ?? []) as Array<{ role: string }>;
      const next: Role = roleRows.some((r) => r.role === "admin")
        ? "admin"
        : roleRows.length
          ? "customer"
          : null;
      setRole(next);
      writeRoleCache(uid, next);
      if (!hadCache) setRoleLoading(false);
    }

    function applyCachedRole(uid: string): boolean {
      const cached = readRoleCache(uid);
      if (cached !== null) {
        setRole(cached);
        return true;
      }
      return false;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mountedRef.current) return;
      genRef.current++;
      const myGen = genRef.current;
      const newUid = s?.user?.id ?? null;
      const uidChanged = newUid !== currentUidRef.current;
      currentUidRef.current = newUid;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const hadCache = applyCachedRole(s.user.id);
        if (!hadCache) setRoleLoading(true);
        // Só revalida no banco se: sem cache, ou troca de usuário, ou evento de
        // sign-in/refresh explícito. TOKEN_REFRESHED a cada hora não precisa rebuscar.
        const needsFetch = !hadCache || uidChanged || _e === "SIGNED_IN";
        if (needsFetch) {
          // Defer para evitar chamada síncrona dentro do callback.
          setTimeout(() => fetchRole(s.user.id, myGen, hadCache), 0);
        }
      } else {
        setRole(null);
        setRoleLoading(false);
        clearRoleCache();
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
          const hadCache = applyCachedRole(s.user.id);
          if (!hadCache) setRoleLoading(true);
          fetchRole(s.user.id, myGen, hadCache);
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
    // `loading` (mantido p/ compat) só reflete a sessão — não trava UI por causa de role.
    loading,
    authLoading: loading,
    roleLoading,
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
      authLoading: true,
      roleLoading: false,
      isAdmin: false,
    };
  }
  return ctx;
}
