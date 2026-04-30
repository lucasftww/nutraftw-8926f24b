import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Escuta INSERTs em `orders` via Supabase Realtime e notifica o admin.
 * - Toast com nome do cliente e total
 * - Badge contador (`unseenCount`) que pode ser zerado com `clear()`
 * - Som curto opcional (Web Audio API, sem assets)
 *
 * Persiste o último ID visto em sessionStorage para evitar re-toast em
 * navegações dentro da mesma sessão.
 */
const LAST_SEEN_KEY = "admin:lastSeenOrderAt";

export function useNewOrdersNotifier(opts: { enabled?: boolean; onNew?: () => void } = {}) {
  const { enabled = true, onNew } = opts;
  const [unseenCount, setUnseenCount] = useState(0);
  const qc = useQueryClient();
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  function playBeep() {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.06;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.18);
      setTimeout(() => ctx.close(), 250);
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    if (!enabled) return;
    const lastSeen = sessionStorage.getItem(LAST_SEEN_KEY);
    const channel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const o: any = payload.new;
          if (lastSeen && o.created_at && o.created_at <= lastSeen) return;
          sessionStorage.setItem(LAST_SEEN_KEY, o.created_at || new Date().toISOString());
          setUnseenCount((n) => n + 1);
          playBeep();
          const total = typeof o.total === "number" ? o.total.toFixed(2).replace(".", ",") : o.total;
          toast.success("Novo pedido recebido", {
            description: `${o.shipping_full_name || "Cliente"} · R$ ${total}`,
            duration: 8000,
          });
          qc.invalidateQueries({ queryKey: ["orders"] });
          onNewRef.current?.();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, qc]);

  function clear() {
    setUnseenCount(0);
    sessionStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }

  return { unseenCount, clear };
}