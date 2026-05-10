import { useEffect } from "react";

/**
 * Lock body scroll de forma segura quando múltiplos componentes
 * (drawer, modal, etc.) podem estar abertos ao mesmo tempo.
 * Usa contador global para só restaurar o overflow quando o último consumidor fecha.
 */
let lockCount = 0;
let originalOverflow: string | null = null;

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    // `didLock` evita que cleanup duplo (StrictMode em dev / fast-refresh)
    // decremente o contador duas vezes — antes podia ir a -1 e nunca mais
    // restaurar `overflow`, deixando a página travada.
    let didLock = false;
    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;
    didLock = true;
    return () => {
      if (!didLock) return;
      didLock = false;
      // Math.max defensivo: se o contador foi mexido por um bug, não vai
      // negativo. Se for 0 aqui, restaura o overflow original.
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow ?? "";
        originalOverflow = null;
      }
    };
  }, [active]);
}