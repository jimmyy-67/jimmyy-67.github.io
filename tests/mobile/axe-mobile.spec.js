/* ============================================================================
 * Accesibilidad con axe-core en viewport móvil (320 px), incluido el menú
 * hamburguesa abierto. Complementa tests/accessibility/axe.spec.js.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { hermetic, gotoView, VIEWS } from "../helpers/site.js";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.use({ bypassCSP: true, viewport: { width: 320, height: 568 } });

test.describe("axe-core en móvil (320 px)", () => {
  for (const view of VIEWS) {
    test(`sin violaciones en #${view}`, async ({ page }) => {
      await hermetic(page);
      await gotoView(page, view);
      await expect(page.locator(`#view-${view}`)).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }

  test("sin violaciones con el menú hamburguesa abierto", async ({ page }) => {
    await hermetic(page);
    await gotoView(page, "portfolio");
    await page.locator(".menu-toggle").click();
    await expect(page.locator("#nav")).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
