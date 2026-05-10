/**
 * Helper compartilhado para exportar dados como CSV (compatível com Excel BR).
 * - Adiciona BOM UTF-8 (acentos corretos no Excel).
 * - Escapa aspas/vírgulas/quebras de linha.
 * - Sanitiza prefixos de fórmula (=, +, -, @, tab, CR) com apóstrofo —
 *   evita CSV injection (atacante criando produto chamado "=cmd|..." que
 *   executaria no Excel quando admin abrisse o relatório).
 * - Faz download imediato no navegador.
 */
export function csvEscape(v: any): string {
  if (v == null) return "";
  let s = String(v).replace(/"/g, '""');
  // Prefixo de fórmula: Excel/LibreOffice tratam células iniciadas por estes
  // caracteres como expressão. Apóstrofo força interpretação como texto.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return /[",\n;]/.test(s) ? `"${s}"` : s;
}

export function downloadCsv<T extends Record<string, any>>(
  filename: string,
  headers: { key: keyof T & string; label: string }[],
  rows: T[],
) {
  const escape = csvEscape;
  const head = headers.map((h) => escape(h.label)).join(",");
  const body = rows
    .map((r) => headers.map((h) => escape(r[h.key])).join(","))
    .join("\n");
  const csv = `${head}\n${body}`;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}