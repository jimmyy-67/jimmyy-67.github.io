/* ============================================================================
 * Condiciones adversas: prefers-reduced-motion: reduce.
 *
 * styles.css desactiva animaciones y transiciones cuando el usuario lo pide.
 * Se comprueba el estilo computado del spinner de estadísticas y de las
 * tarjetas, y que el scroll del botón de subir deje de ser suave.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, jsCards } from "../helpers/site.js";

test.use({ reducedMotion: "reduce" });

test.describe("prefers-reduced-motion: reduce", () => {
  test("las animaciones quedan reducidas a nada", async ({ page }) => {
    await openView(page, "mods");

    /* El spinner de estadísticas deja de girar. */
    const spinner = page.locator("#view-mods .stats-spinner");
    await expect(spinner).toBeAttached();
    const animation = await spinner.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        duration: style.animationDuration,
        iterations: style.animationIterationCount
      };
    });
    /* 0.01ms con 1 iteración: imperceptible. */
    expect(parseFloat(animation.duration)).toBeLessThanOrEqual(0.02);
    expect(animation.iterations).toBe("1");
  });

  test("las transiciones de las tarjetas quedan reducidas", async ({ page }) => {
    await openView(page, "portfolio");

    const card = jsCards(page, "grid-unity").first();
    await expect(card).toBeVisible();
    const duration = await card.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.02);
  });

  test("el scroll del botón de subir ya no es suave", async ({ page }) => {
    await openView(page, "about");

    await page.mouse.wheel(0, 1200);
    const backTop = page.locator("#back-top");
    await expect(backTop).toHaveClass(/visible/);

    /* scroll-behavior: auto -> el retorno es inmediato. */
    await backTop.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(100);
  });
});
