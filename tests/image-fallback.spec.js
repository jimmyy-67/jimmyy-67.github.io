/* ============================================================================
 * Fallback de imágenes (js/utils.js): cadena de respaldo data-fallback ->
 * placeholder local, y estado de error visible si todo falla. Las rutas se
 * bloquean antes de navegar para forzar el error de carga.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { hermetic, gotoView, jsCards } from "./helpers/site.js";

test.describe("Fallback de imágenes", () => {
  test("si falla el WebP/AVIF se usa el PNG de data-fallback", async ({ page }) => {
    await hermetic(page);
    /* La primera tarjeta de Godot (Tree? · Sway) declara fileFallback
       (img/tree-variant.png): WebP/AVIF bloqueados, PNG permitido. */
    await page.route(/\/img\/tree-variant[^/]*\.(webp|avif)(\?|$)/, (route) => route.abort());

    await gotoView(page, "portfolio");
    await page.locator("#gallery-tab-godot").click();

    const img = jsCards(page, "grid-godot").first().locator("img");
    await expect(img).toHaveAttribute("data-fallback-used", "true");
    await expect(img).toHaveAttribute("src", /tree-variant\.png$/);
    await expect(img).toBeVisible();
  });

  test("si también falla el fallback aparece el placeholder local", async ({ page }) => {
    await hermetic(page);
    /* Se bloquean todas las variantes (AVIF, WebP y el PNG de respaldo);
       img/media-placeholder.svg queda permitido. */
    await page.route(/\/img\/portfolio\/MainMenu/, (route) => route.abort());

    await gotoView(page, "portfolio");

    const img = jsCards(page, "grid-unity").first().locator("img");
    /* MainMenu no declara fileFallback: pasa directamente al placeholder. */
    await expect(img).toHaveAttribute("data-placeholder-used", "true");
    await expect(img).toHaveAttribute("src", /media-placeholder\.svg$/);
    await expect(img).toBeVisible();

    /* El marco queda en estado cargado (el placeholder sí responde). */
    await expect(jsCards(page, "grid-unity").locator(".media-frame").first()).toHaveClass(
      /media-loaded/
    );
  });

  test("si hasta el placeholder falla, el marco muestra el estado de error", async ({ page }) => {
    await hermetic(page);
    await page.route(/\/img\/portfolio\/MainMenu/, (route) => route.abort());
    await page.route(/\/img\/media-placeholder\.svg$/, (route) => route.abort());

    await gotoView(page, "portfolio");

    const frame = jsCards(page, "grid-unity").locator(".media-frame").first();
    await expect(frame).toHaveClass(/media-error/);
    await expect(frame).toHaveAttribute("data-media-error", "This image could not be loaded.");
  });

  test("el logo del encabezado también tiene su cadena de respaldo", async ({ page }) => {
    await hermetic(page);
    /* WebP del logo bloqueado; su data-fallback (PNG) permitido. */
    await page.route(/\/img\/portfolio\/Squid_RED[^/]*\.webp(\?|$)/, (route) => route.abort());

    await gotoView(page, "contact");

    const logo = page.locator(".logo-img");
    await expect(logo).toHaveAttribute("data-fallback-used", "true");
    await expect(logo).toHaveAttribute("src", /Squid_RED\.png$/);
  });
});
