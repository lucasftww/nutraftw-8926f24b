import { useEffect } from "react";

interface SEOOptions {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "product" | "article";
  jsonLd?: Record<string, any> | Record<string, any>[];
  /**
   * Diretivas para crawlers. Ex.: "noindex,follow" em páginas de erro/404 para
   * evitar que URLs quebradas entrem no índice do Google. Quando ausente,
   * removemos qualquer `<meta name="robots">` setado pela rota anterior.
   */
  robots?: string;
}

/**
 * Resolve uma URL possivelmente relativa contra o origin do site.
 * - mantém URLs absolutas (http/https/protocol-relative) e data:/blob: intactas;
 * - converte caminhos como `/produto/x` ou `?categoria=y` em URLs absolutas.
 */
function toAbsoluteUrl(value: string, origin: string, base?: string): string {
  if (!value) return value;
  // Já absoluta ou esquema especial
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return value;
  if (value.startsWith("#")) return value; // âncoras puras
  try {
    return new URL(value, base || (origin ? origin + "/" : undefined)).toString();
  } catch {
    return value;
  }
}

// Campos do schema.org cujos valores devem ser URLs absolutas.
const URL_KEYS = new Set([
  "url",
  "item",
  "image",
  "logo",
  "thumbnailUrl",
  "contentUrl",
  "embedUrl",
  "@id",
  "mainEntityOfPage",
  "sameAs",
  "target",
]);

function absolutizeJsonLd<T>(input: T, origin: string, base: string): T {
  if (!input) return input;
  if (Array.isArray(input)) {
    return input.map((v) => absolutizeJsonLd(v, origin, base)) as unknown as T;
  }
  if (typeof input === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input as Record<string, any>)) {
      if (URL_KEYS.has(k)) {
        if (typeof v === "string") {
          out[k] = toAbsoluteUrl(v, origin, base);
        } else if (Array.isArray(v)) {
          out[k] = v.map((item) =>
            typeof item === "string" ? toAbsoluteUrl(item, origin, base) : absolutizeJsonLd(item, origin, base),
          );
        } else if (v && typeof v === "object") {
          out[k] = absolutizeJsonLd(v, origin, base);
        } else {
          out[k] = v;
        }
      } else if (v && typeof v === "object") {
        out[k] = absolutizeJsonLd(v, origin, base);
      } else {
        out[k] = v;
      }
    }
    return out as T;
  }
  return input;
}

function setMeta(attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSEO({ title, description, canonical, image, type = "website", jsonLd, robots }: SEOOptions) {
  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const currentHref = typeof window !== "undefined" ? window.location.href : "";
    // Canonical absoluto (resolvido contra origin), com fallback para a URL atual.
    const canonicalAbs = canonical
      ? toAbsoluteUrl(canonical, origin, currentHref)
      : currentHref;

    if (title) {
      const t = title.length > 60 ? title.slice(0, 57) + "…" : title;
      document.title = t;
      setMeta("property", "og:title", t);
      setMeta("name", "twitter:title", t);
    }
    if (description) {
      const d = description.length > 160 ? description.slice(0, 157) + "…" : description;
      setMeta("name", "description", d);
      setMeta("property", "og:description", d);
      setMeta("name", "twitter:description", d);
    }
    setMeta("property", "og:type", type);
    setMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    if (image) {
      const imgAbs = toAbsoluteUrl(image, origin, canonicalAbs);
      setMeta("property", "og:image", imgAbs);
      setMeta("name", "twitter:image", imgAbs);
    }
    if (canonicalAbs) {
      setLink("canonical", canonicalAbs);
      setMeta("property", "og:url", canonicalAbs);
    }

    // robots: aplica quando fornecido, remove quando ausente — caso contrário
    // um noindex de página anterior persistiria silenciosamente em rotas
    // que o autor pretendia indexar normalmente.
    if (robots) {
      setMeta("name", "robots", robots);
    } else {
      const existing = document.head.querySelector('meta[name="robots"]');
      if (existing) existing.remove();
    }

    let scriptEl: HTMLScriptElement | null = null;
    if (jsonLd) {
      const absJsonLd = absolutizeJsonLd(jsonLd, origin, canonicalAbs || origin + "/");
      scriptEl = document.createElement("script");
      scriptEl.type = "application/ld+json";
      scriptEl.text = JSON.stringify(absJsonLd);
      document.head.appendChild(scriptEl);
    }
    return () => {
      if (scriptEl) document.head.removeChild(scriptEl);
    };
  }, [title, description, canonical, image, type, robots, JSON.stringify(jsonLd)]);
}