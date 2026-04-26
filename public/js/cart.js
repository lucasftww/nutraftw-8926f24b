import { formatBRL, productImageUrl } from "./util.js";

const STORAGE_KEY = "ka-loja-cart-v1";
const MAX_IMG_LEN = 2000;

let cartDrawerClosing = false;

/** @typedef {{ slug: string; name: string; price_cents: number; image_url: string; qty: number }} CartLine */

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function priceLine(cents) {
  return formatBRL(cents).replace(/\s/g, "\u00a0").replace("R$", "R$\u00a0");
}

function loadLines() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (!t) return [];
    const a = JSON.parse(t);
    if (!Array.isArray(a)) return [];
    return a
      .filter(
        (x) =>
          x &&
          typeof x.slug === "string" &&
          typeof x.name === "string" &&
          Number.isFinite(Number(x.price_cents)) &&
          Number.isFinite(Number(x.qty))
      )
      .map((x) => ({
        slug: x.slug,
        name: x.name,
        price_cents: Math.max(0, Math.round(Number(x.price_cents))),
        image_url: typeof x.image_url === "string" ? x.image_url : "",
        qty: Math.max(1, Math.floor(Number(x.qty))),
      }));
  } catch {
    return [];
  }
}

function summarize(lines) {
  let count = 0;
  let totalCents = 0;
  for (const l of lines) {
    count += l.qty;
    totalCents += l.price_cents * l.qty;
  }
  return { count, totalCents, lines };
}

function persist(lines) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* quota: tentar sem imagens longas */
    const trimmed = lines.map((l) => ({
      ...l,
      image_url:
        l.image_url && l.image_url.length > MAX_IMG_LEN ? "" : l.image_url,
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* ignorar */
    }
  }
  window.dispatchEvent(
    new CustomEvent("cartchange", { detail: summarize(lines) })
  );
}

export function clearCart() {
  persist([]);
}

export function getCartSummary() {
  return summarize(loadLines());
}

/** Linhas brutas do carrinho (mesmo formato do localStorage) para checkout. */
export function getCartLines() {
  return loadLines();
}

export function addOrMergeLine(
  { slug, name, price_cents, image_url },
  qty = 1
) {
  const s = String(slug || "").trim();
  if (!s) return;
  const lines = loadLines();
  const i = lines.findIndex((l) => l.slug === s);
  const addQty = Math.max(1, Math.floor(Number(qty) || 1));
  if (i >= 0) {
    lines[i].qty += addQty;
    lines[i].name = String(name || lines[i].name);
    lines[i].price_cents = Math.max(0, Math.round(Number(price_cents)));
    lines[i].image_url = String(image_url ?? lines[i].image_url);
  } else {
    lines.push({
      slug: s,
      name: String(name || s),
      price_cents: Math.max(0, Math.round(Number(price_cents) || 0)),
      image_url: String(image_url || ""),
      qty: addQty,
    });
  }
  persist(lines);
}

export function removeLine(slug) {
  const s = String(slug || "").trim();
  if (!s) return;
  persist(loadLines().filter((l) => l.slug !== s));
}

export function setLineQty(slug, qty) {
  const s = String(slug || "").trim();
  const q = Math.floor(Number(qty));
  if (!s || !Number.isFinite(q)) return;
  const lines = loadLines();
  const i = lines.findIndex((l) => l.slug === s);
  if (i < 0) return;
  if (q <= 0) lines.splice(i, 1);
  else lines[i].qty = q;
  persist(lines);
}

function lineRowHtml(l) {
  const img = esc(productImageUrl(l.image_url));
  const sub = l.price_cents * l.qty;
  return `<div class="flex gap-4 p-3 rounded-2xl border bg-gray-50 border-border/50" data-cart-slug="${esc(l.slug)}">
<div class="w-20 h-20 bg-white rounded-xl overflow-hidden shrink-0 shadow-sm">
<img alt="${esc(l.name)}" class="w-full h-full object-cover" src="${img}" width="80" height="80" loading="lazy" />
</div>
<div class="flex-1 flex flex-col py-1 min-w-0">
<div class="flex justify-between items-start gap-2">
<div class="flex-1 min-w-0"><h4 class="font-semibold text-foreground leading-tight line-clamp-2">${esc(l.name)}</h4></div>
<button type="button" class="js-cart-remove text-muted-foreground hover:text-destructive p-1 transition-colors shrink-0" data-slug="${esc(l.slug)}" aria-label="Remover">
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="lucide lucide-x w-4 h-4" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
</button>
</div>
<div class="mt-auto flex items-end justify-between gap-2">
<span class="font-bold text-primary">${priceLine(sub)}</span>
<div class="flex items-center gap-3 bg-white border border-border rounded-lg p-1 shadow-sm">
<button type="button" class="js-cart-minus w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors" data-slug="${esc(l.slug)}" aria-label="Menos">
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="lucide lucide-minus w-3 h-3"><path d="M5 12h14"></path></svg>
</button>
<span class="text-sm font-medium w-4 text-center js-cart-qty">${l.qty}</span>
<button type="button" class="js-cart-plus w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors" data-slug="${esc(l.slug)}" aria-label="Mais">
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="lucide lucide-plus w-3 h-3"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
</button>
</div>
</div>
</div>
</div>`;
}

function updateBadges(detail) {
  const n = detail?.count ?? 0;
  document.querySelectorAll("[data-cart-badge]").forEach((el) => {
    el.textContent = String(n > 99 ? "99+" : n);
    el.classList.toggle("hidden", n === 0);
  });
}

function renderDrawerContent() {
  const linesEl = document.getElementById("cart-lines");
  const subEl = document.getElementById("cart-subtotal");
  if (!linesEl) return;
  const lines = loadLines();
  if (!lines.length) {
    linesEl.innerHTML = `<p class="text-center text-sm text-muted-foreground py-12">O seu carrinho está vazio.</p>`;
  } else {
    linesEl.innerHTML = `<div class="space-y-6">${lines.map(lineRowHtml).join("")}</div>`;
    linesEl.querySelectorAll(".js-cart-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slug = btn.getAttribute("data-slug");
        if (slug) removeLine(slug);
      });
    });
    linesEl.querySelectorAll(".js-cart-minus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slug = btn.getAttribute("data-slug");
        if (!slug) return;
        const cur = loadLines().find((l) => l.slug === slug);
        if (cur) setLineQty(slug, cur.qty - 1);
      });
    });
    linesEl.querySelectorAll(".js-cart-plus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slug = btn.getAttribute("data-slug");
        if (!slug) return;
        const cur = loadLines().find((l) => l.slug === slug);
        if (cur) setLineQty(slug, cur.qty + 1);
      });
    });
  }
  if (subEl) subEl.textContent = priceLine(summarize(lines).totalCents);
}

function closeMobileNav() {
  const drawer = document.getElementById("mobile-drawer");
  const navBtn = document.getElementById("nav-menu-btn");
  if (drawer) {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
  }
  if (navBtn) navBtn.setAttribute("aria-expanded", "false");
}

export function openCartDrawer() {
  const root = document.getElementById("cart-drawer");
  const panel = document.getElementById("cart-drawer-panel");
  if (!root || !panel) return;
  cartDrawerClosing = false;
  closeMobileNav();
  root.classList.add("is-open");
  root.setAttribute("aria-hidden", "false");
  document.body.classList.add("gi-cart-open");
  document.getElementById("cart-msg")?.classList.add("hidden");
  panel.focus({ preventScroll: true });
  renderDrawerContent();
}

export function closeCartDrawer() {
  const root = document.getElementById("cart-drawer");
  const panel = document.getElementById("cart-drawer-panel");
  if (!root?.classList.contains("is-open") || cartDrawerClosing) return;

  cartDrawerClosing = true;
  let done = false;

  const cleanup = () => {
    if (done) return;
    done = true;
    cartDrawerClosing = false;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gi-cart-open");
  };

  /** @param {TransitionEvent} e */
  function onPanelTransitionEnd(e) {
    if (e.target !== panel) return;
    const p = e.propertyName;
    if (p !== "transform" && p !== "-webkit-transform") return;
    cleanup();
  }

  panel?.addEventListener("transitionend", onPanelTransitionEnd, { once: true });
  window.setTimeout(cleanup, 650);

  root.classList.remove("is-open");
}

function onCartChange(ev) {
  updateBadges(ev.detail);
  const root = document.getElementById("cart-drawer");
  if (root?.classList.contains("is-open")) renderDrawerContent();
  else {
    const subEl = document.getElementById("cart-subtotal");
    if (subEl) subEl.textContent = priceLine(getCartSummary().totalCents);
  }
}

export function initCartDrawer() {
  const root = document.getElementById("cart-drawer");
  if (!root || root.dataset.inited === "1") return;
  root.dataset.inited = "1";

  window.addEventListener("cartchange", onCartChange);

  document.querySelectorAll("#cart-btn, #cart-btn-mobile").forEach((btn) => {
    btn.addEventListener("click", () => openCartDrawer());
  });

  const backdrop = document.getElementById("cart-backdrop");
  const closeBtn = document.getElementById("cart-close");
  backdrop?.addEventListener("click", () => closeCartDrawer());
  closeBtn?.addEventListener("click", () => closeCartDrawer());

  document.getElementById("cart-checkout-btn")?.addEventListener("click", () => {
    const { count } = getCartSummary();
    if (!count) return;
    document.body.classList.remove("gi-cart-open");
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    cartDrawerClosing = false;
    window.location.href = "/checkout.html";
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("is-open")) {
      closeCartDrawer();
    }
  });

  updateBadges(getCartSummary());
  const subEl = document.getElementById("cart-subtotal");
  if (subEl) subEl.textContent = priceLine(getCartSummary().totalCents);
}

initCartDrawer();
