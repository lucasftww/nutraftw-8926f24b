/**
 * Paleta de tons de status padronizada para o painel admin (.dark).
 * Use estas chaves em vez de combinar bg-emerald-50 / text-blue-700 etc.,
 * que quebram o contraste no tema escuro.
 */
export const STATUS_TONE = {
  ok:    "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25",
  warn:  "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",
  info:  "bg-primary/15 text-primary ring-1 ring-primary/25",
  cyan:  "bg-brand-cyan/15 text-brand-cyan ring-1 ring-brand-cyan/25",
  error: "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
  muted: "bg-muted text-muted-foreground ring-1 ring-border",
} as const;

export type StatusTone = keyof typeof STATUS_TONE;