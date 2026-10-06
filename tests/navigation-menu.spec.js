/* ============================================================================
 * Navegación del menú principal en escritorio: el panel es siempre visible,
 * los enlaces cambian de vista, estado activo y hash. La variante móvil
 * (hamburguesa, apertura/cierre) se prueba en tests/mobile/navigation.spec.js.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, VIEWS } from "./helpers/site.js";

test.describe("Menú de navegación (escritorio)", () => {
  test("el panel es visible y el botón hamburguesa no existe", async ({ page }) => {
    await openView(page, "portfolio");

    await expect(page.locator("#nav")).toBeVisible();
    await expect(page.locator(".menu-toggle")).toBeHidden();
    await expect(page.locator("#nav a")).toHaveCount(VIEWS.length);
  });

  for (const view of VIEWS) {
    test(`clic en el enlace ${view} navega a #${view} y marca el estado activo`, async ({
      page
    }) => {
      await openView(page, "portfolio");

      await page.locator(`#nav a[data-view="${view}"]`).click();

      await expect(page).toHaveURL(new RegExp(`#${view}$`));
      await expect(page.locator(`#view-${view}`)).toBeVisible();
      await expect(page.locator(`#view-${view}`)).toHaveClass(/active/);

      const activeLink = page.locator(`#nav a[data-view="${view}"]`);
      await expect(activeLink).toHaveClass(/active/);
      await expect(activeLink).toHaveAttribute("aria-current", "page");
      for (const other of VIEWS.filter((v) => v !== view)) {
        await expect(page.locator(`#nav a[data-view="${other}"]`)).not.toHaveClass(/active/);
        await expect(page.locator(`#view-${other}`)).toBeHidden();
      }
    });
  }

  test("un hash desconocido cae en la vista por defecto (Portfolio)", async ({ page }) => {
    await openView(page, "portfolio");
    await page.goto("/#no-existe");
    await expect(page.locator("#view-portfolio")).toBeVisible();
    await expect(page.locator('#nav a[data-view="portfolio"]')).toHaveClass(/active/);
  });

  test("recargar conserva la vista activa", async ({ page }) => {
    await openView(page, "mods");
    await page.reload();
    await expect(page.locator("#view-mods")).toBeVisible();
    await expect(page.locator('#nav a[data-view="mods"]')).toHaveAttribute("aria-current", "page");
  });

  test("el botón de subir aparece al hacer scroll y vuelve arriba", async ({ page }) => {
    await openView(page, "about");

    const backTop = page.locator("#back-top");
    await expect(backTop).not.toHaveClass(/visible/);

    await page.mouse.wheel(0, 1200);
    await expect(backTop).toHaveClass(/visible/);
    await expect(backTop).toBeVisible();

    await backTop.click();
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 })
      .toBeLessThan(100);
  });
});
