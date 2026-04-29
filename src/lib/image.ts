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