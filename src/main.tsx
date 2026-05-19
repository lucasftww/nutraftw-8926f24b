import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { validateEnv, renderEnvError } from "./lib/validateEnv";

const rootEl = document.getElementById("root")!;
const envCheck = validateEnv();
if (envCheck.ok === false) {
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
// Hosts onde o SW não deve registrar:
// - localhost/127.0.0.1: dev local
// - *.vercel.app: previews por branch/commit (cache do SW polui o preview)
const isPreviewHost =
  host === "localhost" ||
  host === "127.0.0.1" ||
  host.endsWith(".vercel.app");

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
      // Limpa caches de versões anteriores (cache names têm sufixo
      // `-<BUILD_VERSION>`; tudo que não for da versão atual é apagado).
      const currentVersion = (typeof __BUILD_VERSION__ !== "undefined"
        ? __BUILD_VERSION__
        : ""
      ).slice(0, 12);
      if ("caches" in window && currentVersion) {
        caches.keys().then((keys) => {
          keys.forEach((k) => {
            if (
              /^(royalvita-(html|images|assets|api)|google-fonts)-/.test(k) &&
              !k.endsWith(`-${currentVersion}`)
            ) {
              caches.delete(k);
            }
          });
        });
        // Expõe a versão para depuração rápida no console.
        try {
          (window as unknown as { __BUILD_VERSION__?: string }).__BUILD_VERSION__ =
            currentVersion;
        } catch { /* noop */ }
      }
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
