import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config — smoke tests dos fluxos críticos do cliente.
 *
 * Filosofia: poucos testes muito impactantes (catalog → cart → checkout
 * placeholder). E2E não substitui unit tests (vitest) — complementa
 * cobrindo a integração de toda a stack do navegador.
 *
 * Local: `npm run e2e` sobe o dev server e roda os testes.
 * CI:    o workflow ci.yml roda separadamente (não bloqueia o PR atual
 *        até validarmos estabilidade na primeira execução).
 *
 * Para abrir o UI mode (debug visual): `npm run e2e:ui`
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Locale BR — formatação de R$ e datas batem com a expectativa
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  // Smoke em duas viewports — mobile (foco principal) + desktop
  projects: [
    {
      name: "mobile",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Sobe o vite dev server automaticamente. Reusa instância já rodando
  // (para desenvolvedor que tem `npm run dev` aberto em paralelo).
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
