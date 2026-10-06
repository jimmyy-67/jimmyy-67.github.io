/* ============================================================================
 * Accesibilidad automatizada con axe-core (integrado en Playwright).
 *
 * Se analiza cada ruta del router con las reglas WCAG 2.0/2.1/2.2 nivel A y
 * AA. axe-core se inyecta en la página, por lo que el contexto necesita
 * bypassCSP para saltarse la CSP del sitio (solo durante el análisis).
 *
 * El mismo análisis en viewport móvil está en tests/mobile/axe-mobile.spec.js.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openView, VIEWS, jsCards } from "../helpers/site.js";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.use({ bypassCSP: true });

test.describe("axe-core: WCAG 2 A/AA", () => {
  for (const view of VIEWS) {
    test(`sin violaciones en #${view}`, async ({ page }) => {
      await openView(page, view);

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }

  test("sin violaciones con el lightbox abierto", async ({ page }) => {
    await openView(page, "portfolio");
    await jsCards(page, "grid-unity").first().click();
    await expect(page.locator("#lightbox")).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
