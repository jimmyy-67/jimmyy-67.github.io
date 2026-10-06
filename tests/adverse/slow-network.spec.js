/* ============================================================================
 * Condiciones adversas: conexión lenta (throttling de red).
 *
 * Se emula una 3G lenta (400 ms de latencia, 240 kbps de bajada) desde CDP
 * antes de navegar. El sitio debe seguir siendo usable: la vista se
 * renderiza, las tarjetas aparecen y las imágenes terminan cargando, sin
 * errores de JavaScript.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { hermetic, trackPageErrors, jsCards } from "../helpers/site.js";

/* Latencia 400 ms, bajada ~240 kbps, subida ~64 kbps. */
const NETWORK_PRESET = {
  offline: false,
  latency: 400,
  downloadThroughput: (240 * 1024) / 8,
  uploadThroughput: (64 * 1024) / 8
};

test.describe("Conexión lenta (3G emulada)", () => {
  test("la vista Portfolio carga y las imágenes terminan de llegar", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackPageErrors(page);
    await hermetic(page);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", NETWORK_PRESET);

    await page.goto("/#portfolio", { timeout: 90_000 });

    /* La aplicación arranca y la rejilla se construye. */
    await expect(page.locator("body")).toHaveClass(/js-ready/, { timeout: 60_000 });
    const cards = jsCards(page, "grid-unity");
    await expect(cards.first()).toBeVisible({ timeout: 60_000 });

    /* Las imágenes (AVIF pequeños) terminan de cargar con estado loaded. */
    const frames = jsCards(page, "grid-unity").locator(".media-frame");
    await expect
      .poll(
        async () => {
          const total = await frames.count();
          let loaded = 0;
          for (let i = 0; i < total; i++) {
            if ((await frames.nth(i).getAttribute("class"))?.includes("media-loaded")) loaded++;
          }
          return loaded;
        },
        { timeout: 150_000 }
      )
      .toBeGreaterThan(0);

    /* Sin errores de JS pese a la lentitud. */
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("la navegación sigue respondiendo entre vistas con lentitud", async ({ page }) => {
    test.setTimeout(180_000);
    await hermetic(page);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", NETWORK_PRESET);

    await page.goto("/#mods", { timeout: 90_000 });
    await expect(page.locator("#view-mods")).toBeVisible({ timeout: 60_000 });
    await expect(jsCards(page, "mods-grid").first()).toBeVisible({ timeout: 60_000 });

    await page.locator('#nav a[data-view="contact"]').click();
    await expect(page.locator("#view-contact")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("#discord-copy")).toBeVisible();
  });
});
