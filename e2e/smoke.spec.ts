import { test, expect } from "@playwright/test";

/**
 * Smoke geral — health check rápido das rotas públicas. Falha aqui
 * significa página em branco / erro de render / asset 404.
 */

const ROUTES_PUBLIC = [
  { path: "/", title: /Royal Vitta|Catálogo/i },
  { path: "/sobre", title: /Sobre/i },
  { path: "/login", title: /Entrar|Royal Vitta/i },
  { path: "/instalar", title: /Instalar/i },
  { path: "/favoritos", title: /favoritos|Royal Vitta/i },
] as const;

test.describe("smoke: public routes render", () => {
  for (const { path, title } of ROUTES_PUBLIC) {
    test(`${path} renders without runtime error`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      // Console errors também — mas só os críticos (filtra warnings de SW/dev)
      page.on("console", (msg) => {
        if (msg.type() === "error" && !/sourcemap|workbox|InvalidStateError/i.test(msg.text())) {
          errors.push(msg.text());
        }
      });

      await page.goto(path);
      await expect(page).toHaveTitle(title);
      // Header deve estar presente (banner role)
      await expect(page.getByRole("banner")).toBeVisible();
      // Sem erros JS no runtime
      expect(errors).toEqual([]);
    });
  }

  test("404 page handles unknown routes", async ({ page }) => {
    await page.goto("/rota-que-nao-existe-12345");
    // O componente NotFound deve renderizar o 404 com o ícone PackageX
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });
});
