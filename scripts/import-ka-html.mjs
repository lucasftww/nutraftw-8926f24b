/**
 * Lê o HTML exportado do site KA Imports e insere categorias + produtos na BD SQLite (sql.js).
 *
 * Uso:
 *   node scripts/import-ka-html.mjs "c:/Users/Miguel/Downloads/KA Imports (5).html"
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { openDb, listCategoriesAll, createCategory, createProduct } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function stripHtml(t) {
  return String(t || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function brlToCents(reaisPart, centsPart) {
  const whole = String(reaisPart || "").replace(/\./g, "").replace(/,/g, "");
  const frac = String(centsPart || "00").padStart(2, "0").slice(0, 2);
  const n = Number(`${whole}.${frac}`);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function slugifyCat(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function extractProducts(html) {
  const cardRe =
    /tracking-wider uppercase">([^<]+)<\/div><h3 class="font-bold[^"]*">([^<]+)<\/h3><p class="text-xs text-muted-foreground mb-3 line-clamp-2">([\s\S]*?)<\/p><div class="mt-auto">[\s\S]*?<span class="font-bold text-xl text-primary">R\$&nbsp;([\d.]+),(\d{2})<\/span>[\s\S]*?ka-imports\.com\/produto\/([a-f0-9]+)/g;
  const rows = [];
  let m;
  while ((m = cardRe.exec(html))) {
    rows.push({
      categoryLabel: m[1].trim(),
      name: m[2].trim(),
      description: stripHtml(m[3]),
      price_cents: brlToCents(m[4], m[5]),
      slug: m[6],
    });
  }
  return rows;
}

async function main() {
  const htmlPath = process.argv[2];
  if (!htmlPath || !fs.existsSync(htmlPath)) {
    console.error("Indique o caminho do ficheiro HTML.");
    console.error('  node scripts/import-ka-html.mjs "C:/.../KA Imports (5).html"');
    process.exit(1);
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  const products = extractProducts(html);
  if (!products.length) {
    console.error("Nenhum produto encontrado no HTML (estrutura inesperada).");
    process.exit(1);
  }

  await openDb();

  const existingCats = listCategoriesAll();
  const slugToId = new Map();
  for (const c of existingCats) {
    slugToId.set(String(c.slug), Number(c.id));
  }

  const uniqueLabels = [...new Set(products.map((p) => p.categoryLabel))];
  let sort = existingCats.length ? Math.max(...existingCats.map((c) => Number(c.sort_order) || 0)) + 1 : 0;

  for (const label of uniqueLabels) {
    const slug = slugifyCat(label) || `cat-${sort}`;
    if (slugToId.has(slug)) continue;
    const row = createCategory({
      name: label,
      slug,
      sort_order: sort++,
      active: true,
    });
    slugToId.set(String(row.slug), Number(row.id));
    console.log("Categoria:", label, "→", row.slug, "id", row.id);
  }

  let created = 0;
  let skipped = 0;
  for (const p of products) {
    const catSlug = slugifyCat(p.categoryLabel) || "geral";
    let cid = slugToId.get(catSlug);
    if (!cid) {
      const g = slugToId.get("geral");
      cid = g || [...slugToId.values()][0];
    }
    try {
      createProduct({
        slug: p.slug,
        name: p.name,
        description: p.description,
        price_cents: p.price_cents,
        image_url: "",
        stock: 0,
        active: true,
        category_id: cid,
      });
      created++;
      console.log("Produto:", p.name, "—", p.slug);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE") || msg.includes("constraint")) {
        skipped++;
        console.log("Ignorado (já existe):", p.slug);
      } else {
        console.error("Erro:", p.slug, msg);
        throw e;
      }
    }
  }

  console.log("\nResumo:", created, "criados,", skipped, "já existentes,", products.length, "no HTML.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
