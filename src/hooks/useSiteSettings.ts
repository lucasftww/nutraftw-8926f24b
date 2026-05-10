import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cache: Record<string, string> | null = null;
const listeners = new Set<(s: Record<string, string>) => void>();
let inflight: Promise<Record<string, string>> | null = null;

async function load() {
  // Dedup chamadas concorrentes (StrictMode dispara o effect duas vezes em dev).
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await (supabase as any)
      .from("site_settings")
      .select("key, value");
    if (error) {
      // Não derruba a UI: loga, mantém cache anterior se houver, ou objeto vazio.
      console.error("[useSiteSettings] load failed", error);
      const next = cache ?? {};
      cache = next;
      listeners.forEach((l) => l(next));
      return next;
    }
    const next: Record<string, string> = {};
    (data || []).forEach((r: any) => {
      next[r.key] = r.value ?? "";
    });
    cache = next;
    listeners.forEach((l) => l(next));
    return next;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<Record<string, string>>(cache || {});
  useEffect(() => {
    // Adapter: garante referência nova a cada notificação para forçar
    // re-render mesmo se o objeto interno não mudou de identidade.
    const adapter = (s: Record<string, string>) => setSettings({ ...s });
    // Ordem importa: registramos o listener ANTES de disparar load().
    // Antes era o contrário — se o load() resolvesse antes do `listeners.add`,
    // a notificação se perdia e o componente ficava com `{}` para sempre.
    listeners.add(adapter);
    if (cache) {
      setSettings({ ...cache });
    } else {
      load();
    }
    return () => { listeners.delete(adapter); };
  }, []);
  return settings;
}

export async function refreshSiteSettings() {
  // Força re-fetch sem nullificar o cache atual: se outro componente montar
  // durante a janela de fetch, ainda lê os valores antigos (settings críticos
  // como flags de PIX e taxas não somem temporariamente do site público).
  inflight = null;
  return load();
}
