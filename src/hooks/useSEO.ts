import { useEffect } from "react";

interface SEOOptions {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "product" | "article";
  jsonLd?: Record<string, any> | Record<string, any>[];
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

export function useSEO({ title, description, canonical, image, type = "website", jsonLd }: SEOOptions) {
  useEffect(() => {
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
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:image", image);
    }
    const url = canonical || (typeof window !== "undefined" ? window.location.href : "");
    if (url) {
      setLink("canonical", url);
      setMeta("property", "og:url", url);
    }

    let scriptEl: HTMLScriptElement | null = null;
    if (jsonLd) {
      scriptEl = document.createElement("script");
      scriptEl.type = "application/ld+json";
      scriptEl.text = JSON.stringify(jsonLd);
      document.head.appendChild(scriptEl);
    }
    return () => {
      if (scriptEl) document.head.removeChild(scriptEl);
    };
  }, [title, description, canonical, image, type, JSON.stringify(jsonLd)]);
}