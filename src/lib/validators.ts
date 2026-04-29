/**
 * Validadores de campos brasileiros (CPF, CNPJ, CEP, e-mail, telefone).
 * Todos retornam { ok, message? } — `message` só é definido em erro.
 * Validação client-side; o servidor (RPC) continua sendo a fonte da verdade.
 */
import { onlyDigits } from "./utils";

export type FieldStatus = "idle" | "valid" | "invalid";
export interface ValidationResult { ok: boolean; message?: string }

const OK: ValidationResult = { ok: true };
const fail = (message: string): ValidationResult => ({ ok: false, message });

/** RFC-light: cobre 99% dos e-mails reais sem ser absurdamente permissivo. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(raw: string): ValidationResult {
  const v = (raw || "").trim();
  if (!v) return fail("Informe seu e-mail.");
  if (v.length > 255) return fail("E-mail muito longo.");
  if (!EMAIL_RE.test(v)) return fail("E-mail inválido. Ex.: nome@dominio.com");
  return OK;
}

/** Telefone BR: 10 dígitos (fixo) ou 11 (celular com 9 inicial). */
export function validatePhoneBR(raw: string): ValidationResult {
  const d = onlyDigits(raw);
  if (!d) return fail("Informe seu telefone.");
  if (d.length < 10) return fail("Telefone incompleto.");
  if (d.length > 11) return fail("Telefone inválido.");
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return fail("DDD inválido.");
  if (d.length === 11 && d[2] !== "9") return fail("Celular deve começar com 9.");
  return OK;
}

/** CEP BR: exatamente 8 dígitos, não pode ser 00000000. */
export function validateCEP(raw: string): ValidationResult {
  const d = onlyDigits(raw);
  if (!d) return fail("Informe o CEP.");
  if (d.length < 8) return fail("CEP incompleto.");
  if (d.length > 8) return fail("CEP inválido.");
  if (/^0{8}$/.test(d)) return fail("CEP inválido.");
  return OK;
}

/** Algoritmo oficial de CPF (dígitos verificadores). */
export function isValidCPF(raw: string): boolean {
  const d = onlyDigits(raw);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // 000.000.000-00 etc.
  const calc = (slice: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += Number(slice[i]) * (factor - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(d.slice(0, 9), 10);
  if (d1 !== Number(d[9])) return false;
  const d2 = calc(d.slice(0, 10), 11);
  return d2 === Number(d[10]);
}

/** Algoritmo oficial de CNPJ (dígitos verificadores). */
export function isValidCNPJ(raw: string): boolean {
  const d = onlyDigits(raw);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const calc = (slice: string, w: number[]) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += Number(slice[i]) * w[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(d.slice(0, 12), weights1);
  if (d1 !== Number(d[12])) return false;
  const d2 = calc(d.slice(0, 13), weights2);
  return d2 === Number(d[13]);
}

/** Aceita CPF (11 dígitos) OU CNPJ (14 dígitos) — útil para checkout PF/PJ. */
export function validateCPFOrCNPJ(raw: string): ValidationResult {
  const d = onlyDigits(raw);
  if (!d) return fail("Informe o CPF ou CNPJ.");
  if (d.length <= 11) {
    if (d.length < 11) return fail("CPF incompleto.");
    return isValidCPF(d) ? OK : fail("CPF inválido. Verifique os números.");
  }
  if (d.length < 14) return fail("CNPJ incompleto.");
  if (d.length > 14) return fail("Documento inválido.");
  return isValidCNPJ(d) ? OK : fail("CNPJ inválido. Verifique os números.");
}

/** Wrapper só de CPF (mantido para compatibilidade com fluxos PF). */
export function validateCPF(raw: string): ValidationResult {
  const d = onlyDigits(raw);
  if (!d) return fail("Informe o CPF.");
  if (d.length < 11) return fail("CPF incompleto.");
  if (d.length > 11) return fail("CPF inválido.");
  return isValidCPF(d) ? OK : fail("CPF inválido. Verifique os números.");
}

/** Nome completo: ao menos 2 palavras com 2+ letras cada. */
export function validateFullName(raw: string): ValidationResult {
  const v = (raw || "").trim().replace(/\s+/g, " ");
  if (!v) return fail("Informe seu nome.");
  if (v.length < 3) return fail("Nome muito curto.");
  if (v.length > 100) return fail("Nome muito longo.");
  const parts = v.split(" ").filter((p) => p.length >= 2);
  if (parts.length < 2) return fail("Informe nome e sobrenome.");
  if (!/^[\p{L}\s'.-]+$/u.test(v)) return fail("Use apenas letras.");
  return OK;
}