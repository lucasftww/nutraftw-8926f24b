import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "gimports-session-id";
const VIEW_DEDUPE_KEY = "gimports-view-dedupe";
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

/** Evita reenviar o mesmo evento `view` do mesmo produto repetidamente. */
function shouldSkipDuplicateView(productId: string): boolean {
  try {
    const raw = localStorage.getItem(VIEW_DEDUPE_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    // limpa entradas vencidas
    for (const k of Object.keys(map)) {
      if (now - map[k] > VIEW_DEDUPE_TTL_MS) delete map[k];
    }
    if (map[productId] && now - map[productId] < VIEW_DEDUPE_TTL_MS) {
      return true;
    }
    map[productId] = now;
    localStorage.setItem(VIEW_DEDUPE_KEY, JSON.stringify(map));
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
    const { data: auth } = await supabase.auth.getUser();
    await (supabase as any).from("product_events").insert({
      event_type: type,
      product_id: productId ?? null,
      user_id: auth?.user?.id ?? null,
      session_id: getSessionId(),
    });
  } catch {
    /* silencioso */
  }
}