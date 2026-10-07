/* ============================================================================
 * Suite de la ruta #about: presentación, tiles de estadísticas (js/stats.js)
 * y pila técnica.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, trackPageErrors } from "../helpers/site.js";

test.describe("Ruta #about", () => {
  test("muestra la vista About con la presentación y la pila técnica", async ({ page }) => {
    await openView(page, "about");

    await expect(page.getByRole("heading", { level: 2 }).first()).toContainText(
      "Indie dev & Subnautica modder"
    );

    await expect(page.getByText("Background")).toBeVisible();
    await expect(page.getByText("Tech Stack")).toBeVisible();

    const pills = page.locator(".skills-grid .skill-pill");
    expect(await pills.count()).toBeGreaterThanOrEqual(8);
  });

  test("los tiles de estadísticas muestran cifras", async ({ page }) => {
    await openView(page, "about");

    /* El total vive en stats.json (renderAboutStats); sin datos queda el
       respaldo estático del HTML. En ambos casos debe haber un número. */
    await expect(page.locator("#about-dl")).toHaveText(/^\d[\d,]*$/);
    await expect(page.locator("#about-mods")).toHaveText(/^\d+$/);

    /* Estado de la carga de estadísticas presente y announced (role=status). */
    const status = page.locator("#view-about [data-stats-status]");
    await expect(status).toHaveAttribute("role", "status");
    await expect(status).toHaveAttribute("data-state", /ready|stale|error/);
  });

  test("la vista carga sin errores de JavaScript ni de consola locales", async ({ page }) => {
    const errors = trackPageErrors(page);
    await openView(page, "about");
    await expect(page.getByText("Tech Stack")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
