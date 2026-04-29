import { useEffect, useRef, useState } from "react";
import type { FieldStatus, ValidationResult } from "@/lib/validators";

interface Options {
  /** ms para esperar antes de validar enquanto o usuário digita. */
  debounceMs?: number;
  /** Quando true, força a validação imediata (ex.: onBlur ou submit). */
  immediate?: boolean;
  /** Não mostrar erro enquanto o campo está vazio (deixa "idle"). */
  ignoreWhenEmpty?: boolean;
}

/**
 * Hook leve para validar um campo em tempo real, com debounce.
 * Não dispara validação na primeira render quando o campo está vazio
 * (evita "vermelho" antes de o usuário digitar qualquer coisa).
 */
export function useFieldValidation(
  value: string,
  validator: (v: string) => ValidationResult,
  opts: Options = {},
): { status: FieldStatus; message?: string; touch: () => void; reset: () => void } {
  const { debounceMs = 350, immediate = false, ignoreWhenEmpty = true } = opts;
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<{ status: FieldStatus; message?: string }>({ status: "idle" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (ignoreWhenEmpty && !value) {
      setResult({ status: "idle" });
      return;
    }
    if (!touched && !immediate) return;
    const run = () => {
      const r = validator(value);
      setResult({ status: r.ok ? "valid" : "invalid", message: r.message });
    };
    if (immediate || debounceMs === 0) run();
    else timerRef.current = setTimeout(run, debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, touched, immediate]);

  return {
    status: result.status,
    message: result.message,
    touch: () => setTouched(true),
    reset: () => { setTouched(false); setResult({ status: "idle" }); },
  };
}