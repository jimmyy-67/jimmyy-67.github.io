/* ============================================================================
 * Suite de la ruta #portfolio: la vista por defecto, con sus pestañas de
 * galería y su rejilla Unity ya construida por js/gallery.js.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, trackPageErrors, jsCards } from "../helpers/site.js";

test.describe("Ruta #portfolio", () => {
  test("muestra la vista Portfolio y oculta el resto", async ({ page }) => {
    await openView(page, "portfolio");

    await expect(page.locator("#view-portfolio")).toBeVisible();
    for (const view of ["projects", "mods", "about", "contact"]) {
      await expect(page.locator(`#view-${view}`)).toBeHidden();
    }
    await expect(page.getByRole("heading", { level: 2 }).first()).toContainText("in visuals");
  });

  test("el enlace del menú queda marcado como página actual", async ({ page }) => {
    await openView(page, "portfolio");

    const link = page.locator('#nav a[data-view="portfolio"]');
    await expect(link).toHaveClass(/active/);
    await expect(link).toHaveAttribute("aria-current", "page");
    for (const view of ["projects", "mods", "about", "contact"]) {
      await expect(page.locator(`#nav a[data-view="${view}"]`)).not.toHaveAttribute(
        "aria-current",
        "page"
      );
    }
  });

  test("las pestañas de la galería muestran contadores y la pestaña Unity activa", async ({
    page
  }) => {
    await openView(page, "portfolio");

    const tablist = page.getByRole("tablist", { name: "Gallery categories" });
    await expect(tablist).toBeVisible();
    const tabs = tablist.getByRole("tab");
    await expect(tabs).toHaveCount(3);

    const unityTab = page.locator("#gallery-tab-unity");
    await expect(unityTab).toHaveClass(/active/);
    await expect(unityTab).toHaveAttribute("aria-selected", "true");
    for (const id of ["gallery-tab-godot", "gallery-tab-environments"]) {
      await expect(page.locator(`#${id}`)).toHaveAttribute("aria-selected", "false");
    }

    /* El contador de cada pestaña es un número (lo llena initGallery). */
    for (const id of ["gallery-tab-unity", "gallery-tab-godot", "gallery-tab-environments"]) {
      await expect(page.locator(`#${id} .tab-count`)).toHaveText(/^\d+$/);
    }
  });

  test("la rejilla Unity se construye desde manifest.js y los respaldos estáticos se ocultan", async ({
    page
  }) => {
    await openView(page, "portfolio");

    const unityCount = Number(await page.locator("#gallery-tab-unity .tab-count").textContent());
    const cards = jsCards(page, "grid-unity");
    await expect(cards).toHaveCount(unityCount);

    /* Cada tarjeta tiene marco de media y texto alternativo (validado también
       por validate-manifest, aquí se comprueba en el DOM renderizado). */
    const firstImage = cards.first().locator("img");
    await expect(firstImage).toHaveAttribute("alt", /.+/);

    /* Con JS activo los respaldos estáticos del HTML desaparecen. */
    await expect(page.locator("#view-portfolio .static-fallback").first()).toBeHidden();
  });

  test("la vista carga sin errores de JavaScript ni de consola locales", async ({ page }) => {
    const errors = trackPageErrors(page);
    await openView(page, "portfolio");
    await expect(jsCards(page, "grid-unity").first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
