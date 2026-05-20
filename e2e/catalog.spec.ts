import { test, expect } from "@playwright/test";

/**
 * Smoke do catálogo — fluxo de entrada principal do cliente.
 *
 * Cobre os 3 pontos onde mais quebra historicamente:
 *  1. Página carrega + tem produtos no grid
 *  2. Busca funciona e atualiza ?q= na URL
 *  3. Chip de categoria filtra (UX nova desta thread)
 *
 * NÃO testa: filtro drawer, ordenação, paginação. Esses ficam para
 * specs dedicados quando estabilizarmos o smoke principal.
 */

test.describe("catalog", () => {
  test("loads and shows products", async ({ page }) => {
    await page.goto("/");
    // Espera o título da página (SEO via useSEO)
    await expect(page).toHaveTitle(/Catálogo|Royal Vitta/);
    // Pelo menos um link de produto deve renderizar
    const productLinks = page.locator('a[href^="/produto/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 10_000 });
  });

  test("search updates URL and filters results", async ({ page }) => {
    await page.goto("/");
    const search = page.getByPlaceholder("Buscar produtos...");
    await expect(search).toBeVisible();
    await search.fill("tirzepatida");
    // Debounce de busca tem 200ms — espera URL atualizar
    await page.waitForURL(/[?&]q=tirzepatida/i, { timeout: 3_000 });
    // Pelo menos um produto deve ser visível ainda
    const productLinks = page.locator('a[href^="/produto/"]');
    await expect(productLinks.first()).toBeVisible();
  });

  test("category chip filters when clicked", async ({ page }) => {
    await page.goto("/");
    // Chips aparecem após o load — primeiro chip disponível
    const firstChip = page.locator('ul[aria-label="Categorias do catálogo"] button').first();
    if (!(await firstChip.isVisible().catch(() => false))) {
      test.skip(true, "Sem chips disponíveis (sem categorias cadastradas)");
    }
    await firstChip.click();
    // URL ganhou ?categoria=
    await page.waitForURL(/[?&]categoria=/, { timeout: 3_000 });
    // Chip ficou ativo (aria-pressed=true)
    await expect(firstChip).toHaveAttribute("aria-pressed", "true");
  });
});
