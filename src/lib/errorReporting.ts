/**
 * Camada fina de error reporting — wrapper genérico que decide em runtime
 * para qual serviço enviar (atualmente: Sentry). Vantagens:
 *
 * - **Opt-in via env**: sem `VITE_SENTRY_DSN`, nenhum SDK é importado.
 *   O bundler tree-shake elimina o código morto e o usuário não baixa
 *   ~70KB de JS desnecessário em dev/staging sem DSN configurado.
 *
 * - **API estável**: `reportError(error, context)` independe do vendor.
 *   Trocar Sentry por outro serviço (Bugsnag/Honeybadger) altera só
 *   este arquivo, não o ErrorBoundary nem chamadas espalhadas.
 *
 * - **Defensivo**: cada chamada é embrulhada em try/catch — error
 *   reporting NUNCA pode quebrar a página (ironia trágica conhecida).
 *
 * Como ativar em produção:
 *   1. Criar projeto em https://sentry.io (free tier: 5k erros/mês)
 *   2. Copiar o DSN do projeto
 *   3. Adicionar em Vercel → Environment Variables:
 *        VITE_SENTRY_DSN=https://abc@oXXX.ingest.sentry.io/YYY
 *   4. Redeploy. Erros começam a aparecer no dashboard automaticamente.
 */

type SentryModule = typeof import("@sentry/react");

let sentryPromise: Promise<SentryModule | null> | null = null;
let initialized = false;

/**
 * Lazy-init do Sentry. Idempotente: chamadas subsequentes retornam
 * a mesma Promise. Sem DSN configurado, resolve para null (no-op).
 */
async function getSentry(): Promise<SentryModule | null> {
  if (sentryPromise) return sentryPromise;

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    sentryPromise = Promise.resolve(null);
    return sentryPromise;
  }

  sentryPromise = (async () => {
    try {
      // Import dinâmico — fica como chunk separado, só baixa quando ativo
      const Sentry = await import("@sentry/react");
      if (!initialized) {
        Sentry.init({
          dsn,
          environment: import.meta.env.MODE,
          release: typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "dev",
          // Conservador: 10% de tx tracing em prod (5k/mês cobre tranquilo)
          tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
          // Não captura nada de session replay (privacidade + custo)
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0,
          // Filtra ruído comum de browsers / extensões
          ignoreErrors: [
            /ResizeObserver loop/i,
            /Non-Error promise rejection captured/i,
            /Load failed/i,
            /Failed to fetch dynamically imported module/i,
            /ChunkLoadError/i,
          ],
        });
        initialized = true;
      }
      return Sentry;
    } catch (e) {
      console.warn("[errorReporting] Sentry init failed", e);
      return null;
    }
  })();

  return sentryPromise;
}

export interface ErrorContext {
  /** Tag livre para agrupar (ex.: "Checkout", "Cart"). */
  scope?: string;
  /** Dados extras (user id, order id, etc). Não envie PII. */
  extra?: Record<string, unknown>;
  /** Componente React stack quando vindo do ErrorBoundary. */
  componentStack?: string | null;
}

/**
 * Reporta um erro de forma genérica. Não-bloqueante:
 *  - Em dev: só loga no console.
 *  - Em prod com DSN: envia ao Sentry.
 *  - Em prod sem DSN: loga no console (graceful).
 */
export function reportError(error: unknown, ctx: ErrorContext = {}): void {
  // Console sempre — mesmo com Sentry ativo, ajuda no DevTools local.
  console.error(`[${ctx.scope || "app"}]`, error, ctx.extra);

  if (typeof window === "undefined") return;
  if (import.meta.env.DEV) return; // dev: só console

  // Envia em background, sem await — page não pode parar por isso.
  void getSentry().then((Sentry) => {
    if (!Sentry) return;
    try {
      Sentry.withScope((scope) => {
        if (ctx.scope) scope.setTag("scope", ctx.scope);
        if (ctx.componentStack) {
          scope.setContext("react", { componentStack: ctx.componentStack });
        }
        if (ctx.extra) {
          for (const [k, v] of Object.entries(ctx.extra)) {
            scope.setExtra(k, v);
          }
        }
        if (error instanceof Error) {
          Sentry.captureException(error);
        } else {
          Sentry.captureMessage(String(error));
        }
      });
    } catch (e) {
      console.warn("[errorReporting] capture failed", e);
    }
  });
}

/** Identifica o usuário no Sentry (chame após login, NÃO envie email). */
export function setReportingUser(userId: string | null): void {
  if (typeof window === "undefined") return;
  void getSentry().then((Sentry) => {
    if (!Sentry) return;
    try {
      Sentry.setUser(userId ? { id: userId } : null);
    } catch { /* noop */ }
  });
}
