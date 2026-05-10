/**
 * Heurísticas de prefetch sensíveis à conexão.
 *
 * Objetivo: antecipar dados/imagens dos produtos visíveis no catálogo para que,
 * quando o usuário tocar em "Comprar" ou abrir o detalhe, a página já tenha
 * tudo em cache. Tudo é "best-effort": se a rede for fraca ou o usuário
 * estiver com Save-Data, **não fazemos nada** para não desperdiçar dados.
 */

type NetInfo = {
  saveData?: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  downlink?: number;
};

function getConnection(): NetInfo | null {
  if (typeof navigator === "undefined") return null;
  // @ts-expect-error - vendor-prefixed em alguns browsers
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return c ?? null;
}

/**
 * Indica se devemos pré-carregar recursos opcionais agora.
 * Falso quando: usuário pediu Save-Data ou está em 2g/slow-2g.
 */
export function shouldPrefetch(): boolean {
  const c = getConnection();
  if (!c) return true; // Sem info → assume rede ok (desktop, Safari iOS)
  if (c.saveData) return false;
  if (c.effectiveType === "slow-2g" || c.effectiveType === "2g") return false;
  return true;
}

// LRU simples baseado em insertion order do Map. Antes era um Set sem cap —
// em sessão admin de horas navegando catálogo, podia acumular dezenas de
// milhares de URLs. O Map preserva a ordem de inserção, então remover o
// `keys().next()` deleta a entrada mais antiga.
const PREFETCH_MAX_ENTRIES = 200;
const imageCache = new Map<string, number>();

/**
 * Pré-carrega uma imagem (gera o request e popula o cache HTTP/CDN).
 * Idempotente: cada URL só é puxada uma vez por sessão.
 */
export function prefetchImage(url: string | null | undefined): void {
  if (!url || typeof window === "undefined") return;
  if (imageCache.has(url)) return;
  if (!shouldPrefetch()) return;
  // Cap LRU: ao atingir o teto, remove a entrada mais antiga (insertion order).
  if (imageCache.size >= PREFETCH_MAX_ENTRIES) {
    const oldest = imageCache.keys().next().value;
    if (oldest) imageCache.delete(oldest);
  }
  imageCache.set(url, Date.now());
  // `Image()` é mais barato que <link rel=preload> e funciona em todos os browsers.
  const img = new Image();
  // `decode()` permite ao browser preparar a textura sem bloquear; ignoramos erros.
  img.decoding = "async";
  img.loading = "eager";
  img.src = url;
}
