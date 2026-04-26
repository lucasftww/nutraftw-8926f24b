import { addOrMergeLine, openCartDrawer } from "./cart.js";
import { formatBRL, api, productImageUrl } from "./util.js";
import { initSocialProof } from "./social-notify.js";

const slug = decodeURIComponent(
  (location.pathname.split("/").filter(Boolean).pop() || "").trim()
);

const errEl = document.getElementById("p-err");
const img = document.getElementById("p-img");
const cat = document.getElementById("p-cat");
const title = document.getElementById("p-title");
const desc = document.getElementById("p-desc");
const price = document.getElementById("p-price");
const comparePrice = document.getElementById("p-compare-price");
const offerPill = document.getElementById("p-offer-pill");
const shell = document.getElementById("p-shell");
const cartBtn = document.getElementById("p-cart");
/** @type {any|null} */
let loadedProduct = null;

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

function priceDetail(cents) {
  return formatBRL(cents).replace(/\s/g, "\u00a0").replace("R$", "R$\u00a0");
}

async function load() {
  if (!slug) {
    showErr("Produto não especificado.");
    if (shell) shell.classList.add("hidden");
    return;
  }
  showErr("");
  try {
    const { product: p } = await api(
      `/api/products/slug/${encodeURIComponent(slug)}`
    );
    loadedProduct = p;
    document.title = `${p.name} — GIMPORTS`;
    img.src = productImageUrl(p.image_url);
    img.alt = p.name;
    cat.textContent = (p.category_name || "Catálogo").toUpperCase();
    title.textContent = p.name;
    desc.textContent = p.description || "";
    price.textContent = priceDetail(p.price_cents);
    const hasOffer =
      !!p.on_offer &&
      Number(p.compare_price_cents) > 0 &&
      Number(p.compare_price_cents) > Number(p.price_cents);
    if (comparePrice) {
      if (hasOffer) {
        comparePrice.textContent = priceDetail(p.compare_price_cents);
        comparePrice.classList.remove("hidden");
      } else {
        comparePrice.classList.add("hidden");
        comparePrice.textContent = "";
      }
    }
    if (offerPill) {
      offerPill.classList.toggle("hidden", !hasOffer);
    }
  } catch (e) {
    console.error(e);
    showErr(e.message || "Produto não encontrado.");
    if (shell) shell.classList.add("hidden");
  }
}

cartBtn?.addEventListener("click", () => {
  const p = loadedProduct;
  if (!p) return;
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

load();
initSocialProof();
