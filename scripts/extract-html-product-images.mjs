/**
 * Extrai imagens em base64 (data URLs) dos cartões de produto do HTML exportado KA Imports
 * e grava ficheiros numa pasta em Downloads, com nome derivado do alt/título do produto.
 *
 * Uso:
 *   node scripts/extract-html-product-images.mjs "c:/Users/Miguel/Downloads/KA Imports (5).html"
 */
import fs from "fs";
import path from "path";

const WIN_INVALID = /[<>:"/\\|?*\x00-\x1f]/g;

function safeFileName(name, ext) {
  let s = String(name || "sem-nome")
    .replace(WIN_INVALID, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  if (!s) s = "sem-nome";
  return `${s}.${ext}`;
}

function extFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("svg")) return "svg";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "img";
}

/** Aceita data:image/jpeg;base64,... e data:image/svg+xml; charset=utf-8;base64,... */
function parseDataUrl(dataUrl) {
  const s = String(dataUrl);
  if (!s.startsWith("data:")) return null;
  const comma = s.indexOf(",", 5);
  if (comma < 0) return null;
  const meta = s.slice(5, comma);
  const payload = s.slice(comma + 1).replace(/\s/g, "");
  const mime = meta.split(";")[0].trim().toLowerCase();
  if (!mime.startsWith("image/")) return null;
  const isBase64 = /;base64\s*$/i.test(meta) || /^[^;]+;base64$/i.test(meta);
  if (!isBase64 && !/base64/i.test(meta)) return null;
  try {
    return { mime, buffer: Buffer.from(payload, "base64") };
  } catch {
    return null;
  }
}

function extractPairs(html) {
  /** alt antes de src (estrutura típica do export) */
  const re1 =
    /<img[^>]*\balt="([^"]*)"[^>]*\bsrc="(data:image\/[^"]+)"/gi;
  /** src antes de alt (data URL muito longa: limite 50MB por atributo) */
  const re2 =
    /<img[^>]*\bsrc="(data:image\/[^"]+)"[^>]*\balt="([^"]*)"/gi;

  const skip = new Set(["ka imports logo", "logo", ""]);

  const out = [];
  let m;
  while ((m = re1.exec(html))) {
    const alt = m[1].trim();
    if (skip.has(alt.toLowerCase())) continue;
    out.push({ alt, dataUrl: m[2] });
  }
  if (out.length === 0) {
    while ((m = re2.exec(html))) {
      const alt = m[2].trim();
      if (skip.has(alt.toLowerCase())) continue;
      out.push({ alt, dataUrl: m[1] });
    }
  }
  return out;
}

function main() {
  const htmlPath = process.argv[2];
  if (!htmlPath || !fs.existsSync(htmlPath)) {
    console.error('Uso: node scripts/extract-html-product-images.mjs "C:/.../KA Imports (5).html"');
    process.exit(1);
  }

  const outDir = path.join(
    path.dirname(htmlPath),
    "KA-Imports-imagens-produtos"
  );
  fs.mkdirSync(outDir, { recursive: true });

  console.log("A ler HTML (pode demorar um pouco)…");
  const html = fs.readFileSync(htmlPath, "utf8");
  const pairs = extractPairs(html);

  if (!pairs.length) {
    console.error("Nenhuma imagem data:image encontrada com alt de produto.");
    process.exit(1);
  }

  const used = new Map();
  let n = 0;
  for (const { alt, dataUrl } of pairs) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed || !parsed.buffer.length) {
      console.warn("Ignorar (data URL inválida):", alt.slice(0, 60));
      continue;
    }
    const ext = extFromMime(parsed.mime);
    let base = safeFileName(alt, ext);
    let finalName = base;
    let i = 2;
    while (used.has(finalName.toLowerCase())) {
      const stem = base.replace(/\.[^.]+$/, "");
      finalName = `${stem} (${i}).${ext}`;
      i++;
    }
    used.set(finalName.toLowerCase(), true);
    const dest = path.join(outDir, finalName);
    fs.writeFileSync(dest, parsed.buffer);
    n++;
    console.log(finalName);
  }

  console.log(`\n${n} ficheiros em:\n${outDir}`);
}

main();
