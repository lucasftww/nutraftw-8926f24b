/**
 * Copia imagens de Downloads/KA-Imports-imagens-produtos para public/uploads/products/
 * e atualiza image_url de cada produto, fazendo corresponder ficheiro ↔ nome do produto.
 *
 * Uso:
 *   node scripts/attach-download-images.mjs
 *   node scripts/attach-download-images.mjs "D:/outra/pasta"
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { openDb, listProductsAll, updateProduct } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DEFAULT_IMG_DIR = path.join(
  "C:",
  "Users",
  "Miguel",
  "Downloads",
  "KA-Imports-imagens-produtos"
);

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return new Set(norm(s).split(" ").filter(Boolean));
}

function tokenScore(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

/** Melhor produto para este nome de ficheiro (sem extensão). */
function bestProductForStem(stem, products) {
  const ns = norm(stem);
  if (!ns) return null;

  let best = null;
  let bestScore = -1;

  for (const p of products) {
    const pn = norm(p.name);
    if (!pn) continue;

    let score = 0;
    if (pn === ns) score = 1000;
    else if (pn.includes(ns) || ns.includes(pn)) {
      score = 500 + Math.min(pn.length, ns.length) / Math.max(pn.length, ns.length) * 100;
    } else {
      const ts = tokenScore(stem, p.name);
      if (ts >= 0.55) score = ts * 200;
    }

    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  if (bestScore < 100) return null;
  return { product: best, score: bestScore };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeExt(filePath) {
  const e = path.extname(filePath).toLowerCase().replace(".", "");
  if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(e)) return e === "jpeg" ? "jpg" : e;
  return "jpg";
}

async function main() {
  const imgDir = path.resolve(process.argv[2] || DEFAULT_IMG_DIR);
  if (!fs.existsSync(imgDir)) {
    console.error("Pasta não encontrada:", imgDir);
    process.exit(1);
  }

  await openDb();
  const products = listProductsAll();
  const uploadsDir = path.join(ROOT, "public", "uploads", "products");
  ensureDir(uploadsDir);

  const files = fs
    .readdirSync(imgDir)
    .filter((f) => !f.startsWith(".") && fs.statSync(path.join(imgDir, f)).isFile());

  const usedProductIds = new Set();
  let attached = 0;
  const unmatchedFiles = [];
  const skipped = [];

  for (const file of files) {
    const stem = path.basename(file, path.extname(file));
    const match = bestProductForStem(stem, products);
    if (!match) {
      unmatchedFiles.push(file);
      continue;
    }
    const { product } = match;
    if (usedProductIds.has(product.id)) {
      skipped.push(`${file} → produto ${product.id} já tinha ficheiro`);
      continue;
    }

    const ext = safeExt(file);
    const destName = `${product.slug}.${ext}`;
    const destPath = path.join(uploadsDir, destName);
    const srcPath = path.join(imgDir, file);

    fs.copyFileSync(srcPath, destPath);
    const url = `/uploads/products/${destName}`;
    updateProduct(product.id, { image_url: url });
    usedProductIds.add(product.id);
    console.log(`${file} → ${product.name} (${url})`);
    attached++;
  }

  const withoutImage = products.filter((p) => !usedProductIds.has(p.id) && !String(p.image_url || "").trim());

  console.log("\n---");
  console.log(attached, "produtos atualizados.");
  if (unmatchedFiles.length) {
    console.log("Ficheiros sem correspondência clara:", unmatchedFiles.join(", "));
  }
  if (skipped.length) skipped.forEach((s) => console.log(s));
  if (withoutImage.length) {
    console.log(
      "Produtos ainda sem imagem (nome não bateu com nenhum ficheiro):",
      withoutImage.map((p) => p.name).join(" | ")
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
