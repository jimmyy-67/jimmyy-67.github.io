/* ============================================================================
 * Viewports móviles (320, 375 y 768 px): sin desbordamiento horizontal en
 * ninguna vista, con el control de menú correcto para cada ancho.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { hermetic, gotoView, horizontalOverflow, VIEWS } from "../helpers/site.js";

const VIEWPORTS = [
  { width: 320, height: 568 }, // iPhone SE / pequeño
  { width: 375, height: 667 }, // iPhone estándar
  { width: 768, height: 1024 } // tablet: ya es layout de escritorio (>700px)
];

for (const viewport of VIEWPORTS) {
  test.describe(`Viewport ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("el documento no desborda horizontalmente en ninguna vista", async ({ page }) => {
      await hermetic(page);
      for (const view of VIEWS) {
        await gotoView(page, view);
        await expect(page.locator(`#view-${view}`)).toBeVisible();
        const overflow = await horizontalOverflow(page);
        expect(overflow, `desbordamiento en #${view}`).toBeLessThanOrEqual(1);
      }
    });

    test("el control de menú corresponde al ancho de pantalla", async ({ page }) => {
      await hermetic(page);
      await gotoView(page, "portfolio");
      await expect(page.locator(`#view-portfolio`)).toBeVisible();

      const toggle = page.locator(".menu-toggle");
      const nav = page.locator("#nav");
      if (viewport.width <= 700) {
        /* Móvil: hamburguesa visible, panel oculto hasta abrirlo. */
        await expect(toggle).toBeVisible();
        await expect(nav).toBeHidden();
        await toggle.click();
        await expect(nav).toBeVisible();
      } else {
        /* Escritorio: panel siempre visible, sin hamburguesa. */
        await expect(toggle).toBeHidden();
        await expect(nav).toBeVisible();
      }
    });

    test("la cabecera cabe en el ancho de pantalla", async ({ page }) => {
      await hermetic(page);
      await gotoView(page, "portfolio");

      const box = await page.locator("header").boundingBox();
      expect(box).not.toBeNull();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect(box?.x + (box?.width || 0)).toBeLessThanOrEqual(viewport.width + 1);
    });
  });
}
