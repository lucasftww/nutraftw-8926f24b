/**
 * Captura e persistência do código de afiliado (?ref=XXXX ou /r/XXXX).
 * Janela de atribuição: 30 dias (last-click wins).
 */
const KEY = "gimports.affiliate.ref.v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = { code: string; at: number };

export function setAffiliateRef(rawCode: string | null | undefined): string | null {
  if (!rawCode) return null;
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return null;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() } satisfies Stored));
  } catch {
    // localStorage indisponível — segue silencioso
  }
  return code;
}

export function getAffiliateRef(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s?.code || Date.now() - s.at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s.code;
  } catch {
    return null;
  }
}

export function clearAffiliateRef() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}