/**
 * Helper compartilhado para exportar dados como CSV (compatível com Excel BR).
 * - Adiciona BOM UTF-8 (acentos corretos no Excel).
 * - Escapa aspas/vírgulas/quebras de linha.
 * - Faz download imediato no navegador.
 */
export function downloadCsv<T extends Record<string, any>>(
  filename: string,
  headers: { key: keyof T & string; label: string }[],
  rows: T[],
) {
  const escape = (v: any) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };
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