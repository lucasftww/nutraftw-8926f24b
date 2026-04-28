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
    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow ?? "";
        originalOverflow = null;
      }
    };
  }, [active]);
}