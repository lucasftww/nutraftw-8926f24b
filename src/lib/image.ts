/**
 * Helpers de imagem — entrega tamanhos otimizados quando a origem suporta.
 *
 * Aplica o transform de imagens do Supabase Storage (`/render/image/...`) quando
 * a URL for de um bucket público do Supabase. Para qualquer outra origem,
 * devolve a URL original (sem quebrar nada).
 */

const NO_IMAGE = "/assets/no-image.svg";

export interface ImageOpts {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  resize?: "cover" | "contain" | "fill";
}

export function imageUrl(src: string | null | undefined, opts: ImageOpts = {}): string {
  if (!src) return NO_IMAGE;
  // Apenas Supabase Storage suporta o transform via URL; redireciona /object → /render/image
  const supaMatch = src.match(/^(https?:\/\/[^/]+)\/storage\/v1\/object\/(public|sign)\/(.+)$/);
  if (!supaMatch) return src;
  const [, host, mode, rest] = supaMatch;
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  if (opts.quality) params.set("quality", String(opts.quality));
  if (opts.resize) params.set("resize", opts.resize);
  const qs = params.toString();
  return `${host}/storage/v1/render/image/${mode}/${rest}${qs ? `?${qs}` : ""}`;
}

export const NO_IMAGE_SRC = NO_IMAGE;

/**
 * Larguras responsivas padrão para produtos. Cobre densidades 1x/2x/3x desde
 * thumbs até hero em desktops grandes. O navegador escolhe a melhor com `sizes`.
 */
export const PRODUCT_WIDTHS = [240, 320, 400, 560, 800, 1080, 1280] as const;

export interface ResponsiveImage {
  src: string;
  srcSet: string;
  sizes: string;
}

/**
 * Gera `src` (fallback) + `srcSet` (variantes Wxw) para um produto.
 *
 * Para origens que não sejam Supabase Storage, devolve apenas o `src` original
 * (sem srcSet) — assim nada quebra para imagens hospedadas externamente.
 */
export function responsiveImage(
  src: string | null | undefined,
  sizes: string,
  opts: { quality?: number; widths?: readonly number[]; fallbackWidth?: number } = {}
): ResponsiveImage {
  const quality = opts.quality ?? 75;
  const widths = opts.widths ?? PRODUCT_WIDTHS;
  const fallbackWidth = opts.fallbackWidth ?? widths[Math.floor(widths.length / 2)];

  if (!src) {
    return { src: NO_IMAGE, srcSet: "", sizes };
  }
  const isSupabase = /\/storage\/v1\/object\/(public|sign)\//.test(src);
  if (!isSupabase) {
    return { src, srcSet: "", sizes };
  }

  const srcSet = widths
    .map((w) => `${imageUrl(src, { width: w, quality })} ${w}w`)
    .join(", ");

  return {
    src: imageUrl(src, { width: fallbackWidth, quality }),
    srcSet,
    sizes,
  };
}