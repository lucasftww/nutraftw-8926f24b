import { useEffect, useRef } from "react";

/**
 * Acessibilidade para diálogos/drawers:
 *  - Move o foco para dentro do container ao abrir (primeiro elemento focável
 *    ou o próprio container quando nada é focável).
 *  - Mantém o foco preso (Tab/Shift+Tab fazem ciclo) — focus trap.
 *  - Fecha com Escape (chama onClose).
 *  - Restaura o foco para o elemento que estava ativo antes de abrir.
 *
 * Uso:
 *   const ref = useFocusTrap<HTMLDivElement>(open, closeFn);
 *   <aside ref={ref} role="dialog" aria-modal="true">...</aside>
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onEscape?: () => void,
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Garante que o container possa receber foco como fallback.
    if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");

    const getFocusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true" &&
          el.offsetParent !== null,
      );

    // Foco inicial — pequeno timeout para esperar animação/render.
    const focusTimer = window.setTimeout(() => {
      const focusables = getFocusable();
      (focusables[0] ?? node).focus({ preventScroll: true });
    }, 30);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = getFocusable();
      if (focusables.length === 0) {
        e.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      // Restaura foco se o elemento ainda existir e for focável.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        try {
          previouslyFocused.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
    };
  }, [active, onEscape]);

  return ref;
}