/* ============================================================================
 * Carga de estadísticas de Nexus Mods (js/stats.js): camino feliz (stats.json
 * responde), caída de red y JSON corrupto. En los tres casos la UI debe
 * mostrar cifras (reales o de respaldo) y un estado coherente.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { hermetic, gotoView, jsCards } from "./helpers/site.js";

test.describe("Carga de estadísticas", () => {
  test("con stats.json disponible: cifras en vivo y fecha de actualización", async ({ page }) => {
    await hermetic(page);
    await gotoView(page, "mods");

    const status = page.locator("#view-mods [data-stats-status]");
    await expect(status).toHaveAttribute("data-state", /ready|stale/);
    await expect(status).toContainText("Last updated:");
    await expect(status.locator("[data-stats-updated]")).toBeVisible();

    /* Cifras del perfil y de las tarjetas. */
    await expect(page.locator("#mods-profile")).toContainText(/unique downloads from my mods/);
    const statline = jsCards(page, "mods-grid").locator(".mod-statline").first();
    await expect(statline).toBeVisible();
    await expect(statline).toHaveText(/^\d[\d,]* unique downloads$/);

    /* El total de About también se actualiza desde stats.json. */
    await expect(page.locator("#about-dl")).toHaveText(/^\d[\d,]*$/);
  });

  test("sin red para stats.json: estado de error y cifras de respaldo", async ({ page }) => {
    await hermetic(page);
    await page.route(/\/stats\.json/, (route) => route.abort());
    await gotoView(page, "mods");

    const status = page.locator("#view-mods [data-stats-status]");
    await expect(status).toHaveAttribute("data-state", "error");
    await expect(status).toContainText(
      "Statistics could not be refreshed. Showing saved fallback figures."
    );

    /* Las tarjetas muestran el respaldo estático de manifest.js. */
    const statline = jsCards(page, "mods-grid").locator(".mod-statline").first();
    await expect(statline).toBeVisible();
    await expect(statline).toHaveText(/^\d[\d,]* unique downloads$/);

    /* El resumen del perfil se oculta sin datos en vivo. */
    await expect(page.locator("#mods-profile")).toBeHidden();

    /* About conserva el número estático del HTML. */
    await expect(page.locator("#about-dl")).toHaveText(/^\d[\d,]*$/);
  });

  test("stats.json corrupto: mismo estado de error que sin red", async ({ page }) => {
    await hermetic(page);
    await page.route(/\/stats\.json/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "not json" })
    );
    await gotoView(page, "mods");

    await expect(page.locator("#view-mods [data-stats-status]")).toHaveAttribute(
      "data-state",
      "error"
    );
    await expect(jsCards(page, "mods-grid").locator(".mod-statline").first()).toHaveText(
      /^\d[\d,]* unique downloads$/
    );
  });
});
