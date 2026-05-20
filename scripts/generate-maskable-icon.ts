/**
 * Gera `public/pwa-512-maskable.png` a partir de `public/pwa-512.png`.
 *
 * "Maskable" requer ~10% de safe-zone em volta do ícone — launchers
 * Android aplicam máscaras (círculo, squircle, retângulo arredondado)
 * que podem cortar até 20% das bordas. Sem padding, o ícone vira
 * pizza cortada.
 *
 * Este script:
 *  1. Carrega o pwa-512.png existente
 *  2. Cria um canvas 512×512 com a cor da marca como fundo
 *  3. Centraliza o ícone original com 20% de margem (zoom 80%)
 *  4. Salva como pwa-512-maskable.png
 *
 * Roda no `prebuild` — gera o arquivo apenas se estiver ausente OU
 * o source for mais recente. Idempotente, rápido (~50ms).
 *
 * Dependência: `@napi-rs/canvas` (zero-config, sem libs nativas).
 * Se não estiver instalado, falha silenciosa (não bloqueia o build).
 */
import { existsSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PUBLIC_DIR = resolve("public");
const SOURCE = resolve(PUBLIC_DIR, "pwa-512.png");
const OUTPUT = resolve(PUBLIC_DIR, "pwa-512-maskable.png");
const SIZE = 512;
// 20% de padding total (10% em cada lado) — fica no safe-zone do
// maskable spec (60% do raio do círculo Android padrão).
const PADDING_RATIO = 0.2;
// Cor de fundo: navy royal da marca (#0B1F6B = HSL 230 81% 23%)
const BG_COLOR = "#0B1F6B";

async function main() {
  if (!existsSync(SOURCE)) {
    console.warn("[maskable] source pwa-512.png ausente — pulando.");
    return;
  }

  // Skip se output for mais recente que source
  if (existsSync(OUTPUT)) {
    const srcMtime = statSync(SOURCE).mtimeMs;
    const outMtime = statSync(OUTPUT).mtimeMs;
    if (outMtime >= srcMtime) {
      console.log("[maskable] pwa-512-maskable.png já está atualizado.");
      return;
    }
  }

  // Tenta carregar @napi-rs/canvas (opcional)
  let canvasMod: typeof import("@napi-rs/canvas");
  try {
    canvasMod = await import("@napi-rs/canvas");
  } catch {
    console.warn(
      "[maskable] @napi-rs/canvas não instalado. Para gerar o ícone " +
      "maskable, rode: npm i -D @napi-rs/canvas. Pulando por ora — " +
      "o manifest mantém apenas purpose:'any'.",
    );
    return;
  }

  const { createCanvas, loadImage } = canvasMod;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  // Fundo cheio (cor da marca)
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Carrega o ícone original
  const img = await loadImage(readFileSync(SOURCE));

  // Calcula posicionamento com padding
  const padding = SIZE * (PADDING_RATIO / 2);
  const targetSize = SIZE - padding * 2;
  ctx.drawImage(img, padding, padding, targetSize, targetSize);

  // Salva
  const buffer = canvas.toBuffer("image/png");
  writeFileSync(OUTPUT, buffer);
  console.log(`[maskable] gerado pwa-512-maskable.png (${buffer.length} bytes)`);
}

main().catch((e) => {
  console.warn("[maskable] falhou:", e.message);
  // Nunca bloqueia o build
  process.exit(0);
});
