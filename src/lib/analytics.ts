import { supabase } from "@/integrations/supabase/client";

 const SESSION_KEY = "nutra-session-id";
 const VIEW_DEDUPE_KEY = "nutra-view-dedupe";
const VIEW_DEDUPE_TTL_MS = 30 * 60 * 1000; // 30 min

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

// Cap de entradas para evitar crescimento ilimitado do localStorage em
// usuário que navega por milhares de produtos. Mantemos as N mais recentes.
const VIEW_DEDUPE_MAX_ENTRIES = 500;

/** Evita reenviar o mesmo evento `view` do mesmo produto repetidamente. */
function shouldSkipDuplicateView(productId: string): boolean {
  try {
    const raw = localStorage.getItem(VIEW_DEDUPE_KEY);
    // Validação defensiva: `JSON.parse("null")` retorna `null` (Object.keys
    // explode); array é objeto mas `Object.keys` retorna índices numéricos
    // levando a entries inválidas. Aceitar apenas objeto literal.
    const parsed = raw ? JSON.parse(raw) : null;
    const map: Record<string, number> =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    const now = Date.now();
    // limpa entradas vencidas (e valores não-numéricos, defensivo)
    for (const k of Object.keys(map)) {
      const v = map[k];
      if (typeof v !== "number" || !Number.isFinite(v) || now - v > VIEW_DEDUPE_TTL_MS) {
        delete map[k];
      }
    }
    if (map[productId] && now - map[productId] < VIEW_DEDUPE_TTL_MS) {
      return true;
    }
    map[productId] = now;
    // Se ultrapassar o cap, mantém apenas as N mais recentes.
    const keys = Object.keys(map);
    if (keys.length > VIEW_DEDUPE_MAX_ENTRIES) {
      const sorted = keys.sort((a, b) => map[b] - map[a]).slice(0, VIEW_DEDUPE_MAX_ENTRIES);
      const trimmed: Record<string, number> = {};
      for (const k of sorted) trimmed[k] = map[k];
      localStorage.setItem(VIEW_DEDUPE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(VIEW_DEDUPE_KEY, JSON.stringify(map));
    }
    return false;
  } catch {
    return false;
  }
}

type EventType = "view" | "checkout_started";

/**
 * Registra um evento de funil. Falha silenciosamente — analytics nunca
 * deve quebrar a UX. Usa sessionId em localStorage p/ deduplicar views
 * anônimas, e auth.uid() automaticamente quando o usuário está logado.
 */
export async function trackEvent(
  type: EventType,
  productId?: string | null,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (type === "view" && productId && shouldSkipDuplicateView(productId)) {
      return;
    }
    // Usa getSession() (cache local, síncrono no cliente) em vez de
    // getUser() — este último faz network request a cada view e estoura
    // tráfego em páginas de catálogo/produto. A sessão local é
    // suficiente para preencher user_id no evento de funil.
    const { data: sess } = await supabase.auth.getSession();
    await (supabase as any).from("product_events").insert({
      event_type: type,
      product_id: productId ?? null,
      user_id: sess?.session?.user?.id ?? null,
      session_id: getSessionId(),
    });
  } catch {
    /* silencioso */
  }
}