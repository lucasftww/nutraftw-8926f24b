import { addOrMergeLine, openCartDrawer } from "./cart.js";
import { formatBRL, api, productImageUrl } from "./util.js";
import { initSocialProof } from "./social-notify.js";

const grid = document.getElementById("catalog-grid");
const errEl = document.getElementById("catalog-err");
const pillsEl = document.getElementById("category-pills");
const asideEl = document.getElementById("category-aside");

const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right w-4 h-4 ml-1.5" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>`;

const FILTER_TICK = `<svg class="gi-filter-tick" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path class="gi-filter-tick-path" d="M6 12.5l4 4 8-9" /></svg>`;

/** @type {{ id:number, slug:string, name:string, sort_order:number }[]} */
let categories = [];
/** @type {any[]} */
let allProducts = [];
/** @type {string|null} null = todas */
let selectedCategorySlug = null;

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

function setCategory(slug) {
  selectedCategorySlug = slug;
  syncCategoryInputs();
  render();
}

function syncCategoryInputChecksFromState() {
  if (!asideEl) return;
  asideEl.querySelectorAll(".js-cat-check").forEach((inp) => {
    if (!(inp instanceof HTMLInputElement)) return;
    if (inp.classList.contains("js-cat-all")) {
      inp.checked = selectedCategorySlug == null;
    } else {
      inp.checked =
        selectedCategorySlug != null &&
        inp.dataset.slug === selectedCategorySlug;
    }
  });
}

function syncCategoryInputs() {
  const q = getSearchQuery();
  document.querySelectorAll(".js-catalog-search").forEach((el) => {
    if (el instanceof HTMLInputElement) el.value = q;
  });
  syncCategoryInputChecksFromState();
  if (pillsEl) {
    pillsEl.querySelectorAll("[data-cat-pill]").forEach((btn) => {
      const s = btn.getAttribute("data-slug") || "";
      const active = selectedCategorySlug == null ? s === "" : s === selectedCategorySlug;
      btn.classList.toggle("gi-cat-pill--active", active);
    });
  }
}

function renderCategoryFilters() {
  if (pillsEl) {
    const parts = [
      `<button type="button" data-cat-pill data-slug="" class="gi-cat-pill shrink-0 px-4 py-2 rounded-full text-sm font-semibold border border-border bg-white text-muted-foreground gi-cat-pill--active"><span>Todas</span></button>`,
    ];
    for (const c of categories) {
      parts.push(
        `<button type="button" data-cat-pill data-slug="${esc(c.slug)}" class="gi-cat-pill shrink-0 px-4 py-2 rounded-full text-sm font-semibold border border-border bg-white text-muted-foreground"><span>${esc(c.name)}</span></button>`
      );
    }
    pillsEl.innerHTML = parts.join("");
    pillsEl.querySelectorAll("[data-cat-pill]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = btn.getAttribute("data-slug");
        setCategory(s === "" || s == null ? null : s);
      });
    });
  }

  if (asideEl) {
    const parts = [];
    parts.push(`<label class="gi-filter-row flex items-center gap-3 cursor-pointer select-none p-2 -mx-2 rounded-xl hover:bg-muted/50 transition-colors" for="cat-aside-all">
      <input class="gi-filter-input sr-only js-cat-check js-cat-all" type="checkbox" id="cat-aside-all" data-slug="" />
      <span class="gi-filter-box relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-border bg-white shadow-sm">${FILTER_TICK}</span>
      <span class="gi-filter-label-text text-sm font-medium text-muted-foreground transition-colors">Todas as categorias</span>
    </label>`);
    for (const c of categories) {
      const id = `cat-aside-${c.id}`;
      parts.push(`<label class="gi-filter-row flex items-center gap-3 cursor-pointer select-none p-2 -mx-2 rounded-xl hover:bg-muted/50 transition-colors" for="${id}">
        <input class="gi-filter-input sr-only js-cat-check" type="checkbox" id="${id}" data-slug="${esc(c.slug)}" />
        <span class="gi-filter-box relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-border bg-white shadow-sm">${FILTER_TICK}</span>
        <span class="gi-filter-label-text text-sm font-medium text-muted-foreground transition-colors">${esc(c.name)}</span>
      </label>`);
    }
    asideEl.innerHTML = parts.join("");
    asideEl.querySelectorAll(".js-cat-check").forEach((inp) => {
      inp.addEventListener("change", () => {
        if (!(inp instanceof HTMLInputElement)) return;
        if (inp.checked) {
          if (inp.classList.contains("js-cat-all")) {
            selectedCategorySlug = null;
          } else {
            selectedCategorySlug = inp.dataset.slug || null;
          }
        } else {
          if (inp.classList.contains("js-cat-all")) {
            inp.checked = true;
            return;
          }
          selectedCategorySlug = null;
        }
        syncCategoryInputs();
        render();
      });
    });
  }
  syncCategoryInputs();
}

function cardHtml(p) {
  const img = esc(productImageUrl(p.image_url));
  const catLabel = (p.category_name || "Catálogo").toUpperCase();
  const href = `/produto/${encodeURIComponent(p.slug)}`;
  const hasOffer =
    !!p.on_offer &&
    Number(p.compare_price_cents) > 0 &&
    Number(p.compare_price_cents) > Number(p.price_cents);
  const oldPrice = hasOffer
    ? `<span class="text-xs text-muted-foreground line-through decoration-destructive/50">${priceLine(p.compare_price_cents)}</span>`
    : "";
  const offerPill = hasOffer
    ? `<div class="absolute top-3 left-3 bg-destructive text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">OFERTA</div>`
    : "";
  return `<div class="flex" data-product-id="${p.id}">
<div class="group flex flex-col w-full h-full bg-card rounded-2xl border border-border/50 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 overflow-hidden">
<div class="relative aspect-square overflow-hidden bg-muted/30 flex-shrink-0">
<img alt="${esc(p.name)}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${img}" width="600" height="600" />
${offerPill}
</div>
<div class="p-4 flex flex-col flex-1">
<div class="mb-1 text-xs font-semibold text-secondary tracking-wider uppercase">${esc(catLabel)}</div>
<h3 class="font-bold text-foreground text-base mb-1 line-clamp-2 leading-tight">${esc(p.name)}</h3>
<p class="text-xs text-muted-foreground mb-3 line-clamp-2">${esc(p.description || "")}</p>
<div class="mt-auto">
<div class="flex flex-col mb-3">
${oldPrice}
<span class="font-bold text-xl text-primary">${priceLine(p.price_cents)}</span>
</div>
<div class="flex flex-col gap-2">
<button type="button" class="js-add-cart gi-card-btn gi-card-btn--secondary" data-product-id="${p.id}">Ao carrinho</button>
<a href="${href}" class="gi-card-btn gi-card-btn--primary no-underline hover:no-underline">Ver produto${ARROW_SVG}</a>
</div>
</div>
</div>
</div>
</div>`;
}

function showErr(msg) {
  if (!errEl) return;
  if (!msg) {
    errEl.textContent = "";
    errEl.classList.add("hidden");
    return;
  }
  errEl.textContent = msg;
  errEl.classList.remove("hidden");
}

function getSearchQuery() {
  const m = document.getElementById("search-mobile");
  const d = document.getElementById("search-desktop");
  const a = (m?.value || "").trim().toLowerCase();
  const b = (d?.value || "").trim().toLowerCase();
  return a || b;
}

function filterList() {
  const q = getSearchQuery();
  let list = allProducts.slice();
  if (selectedCategorySlug) {
    list = list.filter((p) => (p.category_slug || "") === selectedCategorySlug);
  }
  if (!q) return list;
  return list.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.slug && p.slug.toLowerCase().includes(q)) ||
      (p.category_name && p.category_name.toLowerCase().includes(q))
  );
}

function render() {
  if (!grid) return;
  const list = filterList();
  if (!list.length) {
    grid.innerHTML = `<div class="col-span-full text-center text-sm text-muted-foreground py-16 rounded-2xl border border-dashed border-border bg-muted/20">
      Nenhum produto encontrado. Ajuste filtros ou adicione itens no <a href="/admin" class="text-primary font-semibold underline">admin</a>.
    </div>`;
    return;
  }
  grid.innerHTML = list.map((p) => cardHtml(p)).join("");
}

grid?.addEventListener("click", (e) => {
  const btn = e.target.closest(".js-add-cart");
  if (!btn || !grid.contains(btn)) return;
  const id = Number(btn.getAttribute("data-product-id"));
  const p = allProducts.find((x) => x.id === id);
  if (!p) return;
  e.preventDefault();
  addOrMergeLine(
    {
      slug: p.slug,
      name: p.name,
      price_cents: p.price_cents,
      image_url: p.image_url || "",
    },
    1
  );
  openCartDrawer();
});

function syncSearchInputs(value) {
  document.querySelectorAll(".js-catalog-search").forEach((el) => {
    if (el instanceof HTMLInputElement) el.value = value;
  });
}

async function load() {
  showErr("");
  if (grid) {
    grid.innerHTML = `<div class="col-span-full text-center text-sm text-muted-foreground py-12">A carregar catálogo…</div>`;
  }
  try {
    const data = await api("/api/catalog");
    categories = data.categories || [];
    allProducts = data.products || [];
    renderCategoryFilters();
    render();
    initSocialProof({
      getProductNames: () => allProducts.map((p) => p.name),
    });
  } catch (e) {
    console.error(e);
    showErr(e.message || "Erro ao carregar produtos.");
    if (grid) grid.innerHTML = "";
  }
}

document.querySelectorAll(".js-catalog-search").forEach((el) => {
  el.addEventListener("input", () => {
    const v = el instanceof HTMLInputElement ? el.value : "";
    syncSearchInputs(v);
    render();
  });
});

load();
