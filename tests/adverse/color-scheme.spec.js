/* ============================================================================
 * Condiciones adversas: prefers-color-scheme: dark.
 *
 * El sitio define su propio tema oscuro y no se apoya en el esquema del
 * sistema: con dark activo el resultado debe ser idéntico (mismos colores,
 * sin inversión sorpresiva) y la página completamente funcional.
 * ==========================================================================*/
import { test, expect, devices } from "@playwright/test";
import { hermetic, gotoView, VIEWS, jsCards } from "../helpers/site.js";

/* Todo el archivo se ejecuta con dark activo, salvo la comparativa de
   colores, que crea sus propios contextos con cada esquema. */
test.use({ colorScheme: "dark" });

test.describe("prefers-color-scheme: dark", () => {
  test("los colores del sitio no cambian con el esquema del sistema", async ({ browser }) => {
    const readTheme = async (colorScheme) => {
      const context = await browser.newContext({
        ...devices["Desktop Chrome"],
        colorScheme
      });
      const page = await context.newPage();
      await hermetic(page);
      await gotoView(page, "portfolio");
      const colors = await page.evaluate(() => ({
        body: getComputedStyle(document.body).backgroundColor,
        header: getComputedStyle(document.querySelector("header")).backgroundColor,
        text: getComputedStyle(document.body).color
      }));
      await context.close();
      return colors;
    };

    const light = await readTheme("light");
    const dark = await readTheme("dark");

    /* Tema propio del sitio: idéntico con cualquier esquema del sistema. */
    expect(dark).toEqual(light);
    expect(dark.body).not.toBe("rgba(0, 0, 0, 0)");
  });

  for (const view of VIEWS) {
    test(`la vista #${view} es funcional con dark activo`, async ({ page }) => {
      await hermetic(page);
      await gotoView(page, view);
      await expect(page.locator(`#view-${view}`)).toBeVisible();
      await expect(page.locator("body")).toHaveClass(/js-ready/);
    });
  }

  test("el lightbox funciona con dark activo", async ({ page }) => {
    await hermetic(page);
    await gotoView(page, "portfolio");
    await jsCards(page, "grid-unity").first().click();
    await expect(page.locator("#lightbox")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#lightbox")).toHaveAttribute("aria-label", /Image 2 of /);
    await page.keyboard.press("Escape");
    await expect(page.locator("#lightbox")).toBeHidden();
  });
});
