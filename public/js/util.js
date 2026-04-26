export function formatBRL(cents) {
  const v = Number(cents) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Aceita http(s) ou caminho absoluto local; caso contrário usa placeholder. */
export function productImageUrl(url) {
  const s = url != null ? String(url).trim() : "";
  if (!s) return "/assets/no-image.svg";
  if (
    s.startsWith("https://") ||
    s.startsWith("http://") ||
    s.startsWith("/")
  ) {
    return s;
  }
  return "/assets/no-image.svg";
}

export async function api(path, opts = {}) {
  const { headers: headerIn, ...rest } = opts;
  const headers = {
    ...(headerIn && typeof headerIn === "object" ? headerIn : {}),
  };
  const hasBody = rest.body != null && rest.body !== "";
  const isFormData =
    typeof FormData !== "undefined" && rest.body instanceof FormData;
  if (
    hasBody &&
    !isFormData &&
    !headers["Content-Type"] &&
    !headers["content-type"]
  ) {
    headers["Content-Type"] = "application/json";
  }
  const r = await fetch(path, {
    credentials: "same-origin",
    ...rest,
    headers,
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || r.statusText);
  }
  if (!r.ok) {
    const msg = data?.error || r.statusText;
    const err = new Error(msg);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}
