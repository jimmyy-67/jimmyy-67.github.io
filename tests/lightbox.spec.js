/* ============================================================================
 * Lightbox (js/lightbox.js): apertura, cierre (botón, fondo y Escape),
 * navegación con flechas, foco atrapado y retorno del foco al disparador.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, jsCards } from "./helpers/site.js";

async function openFirstCard(page) {
  const card = jsCards(page, "grid-unity").first();
  await card.click();
  const dialog = page.locator("#lightbox");
  await expect(dialog).toBeVisible();
  return { card, dialog };
}

test.describe("Lightbox", () => {
  test("abrir una tarjeta muestra el medio con título y posición", async ({ page }) => {
    await openView(page, "portfolio");
    const { dialog } = await openFirstCard(page);

    /* El foco cae en el botón de cierre. */
    await expect(dialog.locator(".lightbox-close")).toBeFocused();

    /* La imagen se carga (la clase media-loaded la añade watchImage). */
    await expect(dialog.locator(".lb-image")).toBeVisible();
    await expect(dialog.locator(".lightbox-media")).toHaveClass(/media-loaded/);

    /* El aria-label del diálogo anuncia título y posición. */
    await expect(dialog).toHaveAttribute("aria-label", /Main Menu/);
    await expect(dialog).toHaveAttribute("aria-label", /Image 1 of \d+/);
  });

  test("Escape cierra el lightbox y devuelve el foco a la tarjeta", async ({ page }) => {
    await openView(page, "portfolio");
    const { card, dialog } = await openFirstCard(page);

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(card).toBeFocused();
  });

  test("el botón de cierre cierra el lightbox", async ({ page }) => {
    await openView(page, "portfolio");
    const { dialog } = await openFirstCard(page);

    await dialog.locator(".lightbox-close").click();

    await expect(dialog).toBeHidden();
  });

  test("clic en el fondo (fuera del medio) cierra el lightbox", async ({ page }) => {
    await openView(page, "portfolio");
    const { dialog } = await openFirstCard(page);

    /* Esquina izquierda: fuera del medio (centrado, 40vw mínimo) y del
       botón de cierre (arriba a la derecha). */
    await page.mouse.click(8, 400);

    await expect(dialog).toBeHidden();
  });

  test("las flechas navegan entre imágenes y envuelven al final", async ({ page }) => {
    await openView(page, "portfolio");
    const { dialog } = await openFirstCard(page);

    const label = () => dialog.getAttribute("aria-label");

    /* Posición inicial y total. */
    expect(await label()).toMatch(/Image 1 of (\d+)/);
    const total = Number((/Image 1 of (\d+)/.exec(await label()) || [])[1]);
    expect(total).toBeGreaterThan(1);

    /* Siguiente imagen. */
    await page.keyboard.press("ArrowRight");
    await expect(dialog).toHaveAttribute("aria-label", /Image 2 of /);
    await expect(dialog.locator(".lb-image")).toBeVisible();

    /* Anterior desde la primera envuelve a la última. */
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(dialog).toHaveAttribute("aria-label", new RegExp(`Image ${total} of `));

    /* Siguiente desde la última envuelve a la primera. */
    await page.keyboard.press("ArrowRight");
    await expect(dialog).toHaveAttribute("aria-label", /Image 1 of /);
  });

  test("el foco queda atrapado dentro del diálogo mientras está abierto", async ({ page }) => {
    await openView(page, "portfolio");
    const { dialog } = await openFirstCard(page);

    const closeButton = dialog.locator(".lightbox-close");
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Tab");
      await expect(closeButton).toBeFocused();
    }
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Shift+Tab");
      await expect(closeButton).toBeFocused();
    }
  });

  test("abrir con teclado: Enter y Espacio sobre una tarjeta", async ({ page }) => {
    await openView(page, "portfolio");
    const card = jsCards(page, "grid-unity").first();
    const dialog = page.locator("#lightbox");

    await card.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-label", /Image 1 of /);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await card.focus();
    await page.keyboard.press("Space");
    await expect(dialog).toBeVisible();
  });
});
