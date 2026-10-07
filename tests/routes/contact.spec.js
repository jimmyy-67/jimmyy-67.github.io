/* ============================================================================
 * Suite de la ruta #contact: tarjetas de contacto y redes (la interacción
 * de copiar Discord se prueba en detalle en tests/discord-copy.spec.js).
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, trackPageErrors } from "../helpers/site.js";

test.describe("Ruta #contact", () => {
  test("muestra la vista Contact con email, Discord y redes", async ({ page }) => {
    await openView(page, "contact");

    await expect(page.getByRole("heading", { level: 2 }).first()).toContainText("Have an idea?");

    /* Email */
    const email = page.locator('a[href^="mailto:"]');
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute("href", /^mailto:.+@.+\..+$/);

    /* Discord: botón real (no enlace) con el usuario visible. */
    const discord = page.locator("#discord-copy");
    await expect(discord).toBeVisible();
    await expect(discord).toHaveText("jimy1_");
    await expect(discord).toHaveAttribute("type", "button");

    /* Plataformas: enlaces externos seguros. */
    const pills = page.locator(".social-grid .social-pill");
    const count = await pills.count();
    expect(count).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < count; i++) {
      await expect(pills.nth(i)).toHaveAttribute("target", "_blank");
      await expect(pills.nth(i)).toHaveAttribute("rel", /noopener/);
    }
  });

  test("la vista carga sin errores de JavaScript ni de consola locales", async ({ page }) => {
    const errors = trackPageErrors(page);
    await openView(page, "contact");
    await expect(page.locator("#discord-copy")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
