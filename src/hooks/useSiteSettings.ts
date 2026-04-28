import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cache: Record<string, string> | null = null;
const listeners = new Set<(s: Record<string, string>) => void>();

async function load() {
  const { data } = await (supabase as any).from("site_settings").select("key, value");
  const next: Record<string, string> = {};
  (data || []).forEach((r: any) => { next[r.key] = r.value ?? ""; });
  cache = next;
  listeners.forEach((l) => l(next));
  return next;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<Record<string, string>>(cache || {});
  useEffect(() => {
    if (!cache) load(); else setSettings(cache);
    listeners.add(setSettings);
    return () => { listeners.delete(setSettings); };
  }, []);
  return settings;
}

export async function refreshSiteSettings() {
  return load();
}
