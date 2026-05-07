import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { validateEnv, renderEnvError } from "./lib/validateEnv";

const rootEl = document.getElementById("root")!;
const envCheck = validateEnv();
if (!envCheck.ok) {
  // eslint-disable-next-line no-console
  console.error(`[env] ${envCheck.message}`);
  renderEnvError(rootEl, envCheck);
} else {
  createRoot(rootEl).render(<App />);
}

// PWA service worker — only register in production AND outside iframes/preview hosts.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovable.dev") ||
  host === "localhost" ||
  host === "127.0.0.1";

if (isInIframe || isPreviewHost || import.meta.env.DEV) {
  // Defensive: tear down any leftover SW in preview/dev so caches don't poison the editor.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }
} else {
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      // Atualização instantânea: assim que o novo SW assume o controle
      // (`controllerchange`), recarregamos a aba para garantir que o
      // usuário veja o build novo SEM precisar limpar cache nem fechar
      // todas as abas. Combinado com `skipWaiting + clientsClaim` no
      // workbox, o ciclo dura segundos após o publish.
      let reloading = false;
      navigator.serviceWorker?.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
      registerSW({
        immediate: true,
        onNeedRefresh() {
          // SW novo já está esperando — manda ativar imediatamente.
          // O reload acontece via `controllerchange` acima.
          navigator.serviceWorker?.getRegistration().then((reg) => {
            reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
          });
        },
      });
    })
    .catch(() => {
      /* noop */
    });
}
