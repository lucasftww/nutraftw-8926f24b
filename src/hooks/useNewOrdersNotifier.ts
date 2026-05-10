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
  // AudioContext único reutilizado entre toques. Antes, cada novo pedido
  // criava um Ctx que não era fechado de forma confiável (Chrome limita ~6
  // contexts por aba). Numa noite movimentada, vazava e o beep parava.
  const ctxRef = useRef<AudioContext | null>(null);
  // Mantém referência ao lastSeenRef do useEffect ativo para que clear()
  // possa sincronizar o baseline sem re-executar o efeito.
  const clearLastSeenRef = useRef<{ current: string } | null>(null);

  function playBeep() {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctx) return;
      if (!ctxRef.current) ctxRef.current = new Ctx();
      const ctx = ctxRef.current;
      // Auto-resume: navegadores suspendem o context se ficou inativo.
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.06;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.18);
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    return () => {
      // Fecha o AudioContext único quando o hook desmonta (logout/navegação
      // para fora do admin) — libera recurso de áudio.
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Baseline: na primeira sessão do navegador, marca AGORA como último visto
    // para evitar que reconexões do canal Realtime entreguem eventos antigos
    // como "novos pedidos". Comparação estrita (`>`) evita re-toast do mesmo.
    let lastSeen = sessionStorage.getItem(LAST_SEEN_KEY);
    if (!lastSeen) {
      lastSeen = new Date().toISOString();
      sessionStorage.setItem(LAST_SEEN_KEY, lastSeen);
    }
    // Ref compartilhado entre o listener e clear() para manter sincronismo
    // quando clear() é chamado fora do contexto do useEffect.
    const lastSeenRef = { current: lastSeen };
    const channel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const o: any = payload.new;
          if (o.created_at && o.created_at <= lastSeenRef.current) return;
          // Atualiza TANTO o sessionStorage QUANTO a ref de closure,
          // para que reconexões do canal Realtime não re-toast pedidos
          // que já foram exibidos nesta sessão.
          lastSeenRef.current = o.created_at || new Date().toISOString();
          sessionStorage.setItem(LAST_SEEN_KEY, lastSeenRef.current);
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
    // Expõe lastSeenRef para clear() via ref externo.
    clearLastSeenRef.current = lastSeenRef;
    return () => { supabase.removeChannel(channel); };
  }, [enabled, qc]);

  function clear() {
    setUnseenCount(0);
    const now = new Date().toISOString();
    sessionStorage.setItem(LAST_SEEN_KEY, now);
    // Sincroniza a ref ativa para evitar re-toast em reconexões do Realtime.
    if (clearLastSeenRef.current) clearLastSeenRef.current.current = now;
  }

  return { unseenCount, clear };
}