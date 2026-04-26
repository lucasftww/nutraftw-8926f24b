/**
 * Importa produtos reais do KA Imports (api pública) para o DB local.
 * Salva imagens base64 em public/uploads/products/ e zera demos.
 *
 * Uso: node scripts/seed-from-ka-api.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  openDb,
  listCategoriesAll,
  createCategory,
  createProduct,
} from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "public", "uploads", "products");
const KA_URL = "https://www.ka-imports.com/api/products";

function slugify(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function saveBase64Image(dataUrl, slug) {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return "/assets/no-image.svg";
  }
  const m = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  if (!m) return "/assets/no-image.svg";
  const ext = m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
  const buf = Buffer.from(m[2], "base64");
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const file = `${slug}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, file), buf);
  return `/uploads/products/${file}`;
}

async function main() {
  const db = await openDb();
  console.log("Buscando catálogo KA...");
  const res = await fetch(KA_URL);
  if (!res.ok) throw new Error(`KA API ${res.status}`);
  const data = await res.json();
  const products = Array.isArray(data.products) ? data.products : [];
  console.log(`> ${products.length} produtos recebidos`);

  // 1) Apaga produtos demo + reseta tabela
  db.exec("DELETE FROM products");
  console.log("> produtos antigos removidos");

  // 2) Garante categorias
  const catNames = [...new Set(products.map((p) => String(p.category || "Geral").trim()))];
  const existing = listCategoriesAll();
  const catBySlug = new Map(existing.map((c) => [c.slug, c]));
  const catByName = new Map();
  for (const name of catNames) {
    const slug = slugify(name) || "geral";
    let cat = catBySlug.get(slug);
    if (!cat) {
      cat = createCategory({ name, slug, sort_order: 0, active: true });
      catBySlug.set(slug, cat);
      console.log(`  + categoria: ${name}`);
    }
    catByName.set(name, cat);
  }

  // 3) Insere produtos
  let ok = 0;
  for (const p of products) {
    const name = String(p.name || "").trim();
    if (!name) continue;
    const slug = slugify(name) || `produto-${p.id}`;
    const imageUrl = saveBase64Image(p.image, slug);
    const promo = Number(p.promoPrice) > 0 && Number(p.promoPrice) < Number(p.price);
    const price_cents = Math.round(Number(promo ? p.promoPrice : p.price) * 100);
    const compare_price_cents = promo ? Math.round(Number(p.price) * 100) : 0;
    const cat = catByName.get(String(p.category || "Geral").trim());
    try {
      createProduct({
        slug,
        name,
        description: String(p.description || ""),
        price_cents,
        on_offer: promo ? 1 : 0,
        compare_price_cents,
        image_url: imageUrl,
        stock: p.isSoldOut ? 0 : 50,
        active: p.isActive === false ? 0 : 1,
        category_id: cat ? cat.id : null,
        inventory_mode: "local",
        low_stock_threshold: 5,
        allow_backorder: 0,
      });
      ok++;
    } catch (e) {
      console.warn(`  ! falhou ${name}: ${e.message}`);
    }
  }
  console.log(`> ${ok}/${products.length} produtos inseridos`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
