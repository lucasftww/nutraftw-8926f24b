/**
 * Captura e persistência do código de afiliado (?ref=XXXX ou /r/XXXX).
 * Janela de atribuição: 30 dias (last-click wins).
 */
const KEY = "gimports.affiliate.ref.v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AffiliateAttribution = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  landing_path?: string | null;
  referrer?: string | null;
};

type Stored = { code: string; at: number } & AffiliateAttribution;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

/** Lê UTMs do search atual + landing_path + referrer (somente same-origin/seguros). */
export function readAttributionFromUrl(search?: string): AffiliateAttribution {
  const sp = new URLSearchParams(search ?? (typeof window !== "undefined" ? window.location.search : ""));
  const out: AffiliateAttribution = {};
  for (const k of UTM_KEYS) {
    const v = sp.get(k);
    if (v) out[k] = v.slice(0, 200);
  }
  if (typeof window !== "undefined") {
    out.landing_path = (window.location.pathname + window.location.search).slice(0, 500);
    out.referrer = (document.referrer || "").slice(0, 500) || null;
  }
  return out;
}

export function setAffiliateRef(
  rawCode: string | null | undefined,
  attribution?: AffiliateAttribution,
): string | null {
  if (!rawCode) return null;
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return null;
  try {
    const payload: Stored = { code, at: Date.now(), ...(attribution || {}) };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // localStorage indisponível — segue silencioso
  }
  return code;
}

export function getAffiliateRef(): string | null {
  return getAffiliateRefData()?.code ?? null;
}

/** Retorna o registro completo (código + UTMs + timestamp), ou null se inválido/expirado. */
export function getAffiliateRefData(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s?.code || Date.now() - s.at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearAffiliateRef() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}