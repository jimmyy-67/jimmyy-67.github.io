/* ============================================================================
 * Suite de la ruta #mods: tarjetas de mods (js/mods.js) y estadísticas de
 * Nexus Mods (js/stats.js). Los valores numéricos exactos viven en
 * stats.json/manifest.js y cambian con el tiempo: aquí se comprueba que
 * haya cifras renderizadas y estados correctos, no valores concretos.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, trackPageErrors, jsCards } from "../helpers/site.js";

test.describe("Ruta #mods", () => {
  test("muestra la vista Mods con las tarjetas de los mods", async ({ page }) => {
    await openView(page, "mods");

    const cards = jsCards(page, "mods-grid");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(2);

    /* Cada tarjeta enlaza a Nexus y, si hay repositorio, al código fuente. */
    const nexusLinks = cards.locator("a.card-link", { hasText: "View on Nexus" });
    const nexusCount = await nexusLinks.count();
    expect(nexusCount).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < nexusCount; i++) {
      await expect(nexusLinks.nth(i)).toHaveAttribute("href", /nexusmods\.com/);
    }
    const sourceLinks = cards.locator("a.card-link", { hasText: "Source" });
    const sourceCount = await sourceLinks.count();
    for (let i = 0; i < sourceCount; i++) {
      await expect(sourceLinks.nth(i)).toHaveAttribute("href", /github\.com/);
    }
    await expect(cards.first().locator(".card-label")).toContainText("Mod · Subnautica");

    /* El respaldo estático queda oculto con JS activo. */
    await expect(page.locator("#mods-grid .static-fallback").first()).toBeHidden();
  });

  test("las estadísticas de Nexus se cargan con estado y cifra visibles", async ({ page }) => {
    await openView(page, "mods");

    /* stats.json manda: el estado pasa a ready (o stale si tiene más de 48 h). */
    const status = page.locator("#view-mods [data-stats-status]");
    await expect(status).toHaveAttribute("data-state", /ready|stale/);
    await expect(status).toContainText("Last updated:");

    /* Cada tarjeta muestra su línea de descargas únicas con cifra. */
    const statlines = jsCards(page, "mods-grid").locator(".mod-statline");
    const count = await statlines.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      await expect(statlines.nth(i)).toBeVisible();
      await expect(statlines.nth(i)).toContainText(/unique downloads/);
      await expect(statlines.nth(i)).toHaveText(/\d/);
    }

    /* Resumen del perfil con el total de descargas únicas. */
    const profile = page.locator("#mods-profile");
    await expect(profile).toBeVisible();
    await expect(profile).toContainText("unique downloads from my mods");
  });

  test("la vista carga sin errores de JavaScript ni de consola locales", async ({ page }) => {
    const errors = trackPageErrors(page);
    await openView(page, "mods");
    await expect(jsCards(page, "mods-grid").first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
