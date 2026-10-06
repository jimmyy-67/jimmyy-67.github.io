/* ============================================================================
 * Navegación solo con teclado: Tab/Shift+Tab recorren un orden de foco
 * coherente, Enter/Espacio activan botones y tarjetas, y Escape cierra
 * menú y lightbox. Cubre el requisito 2.1.1 (Teclado) y 2.4.3 (Orden de
 * foco) de WCAG; el repaso con NVDA/VoiceOver está en
 * docs/manual-accessibility-checklist.md.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, focusedElement, jsCards } from "../helpers/site.js";

test.describe("Navegación solo con teclado", () => {
  test("Tab recorre el encabezado en orden lógico", async ({ page }) => {
    await openView(page, "portfolio");

    /* Orden esperado: logo -> Portfolio -> Projects -> Mods -> About ->
       Contact -> primera pestaña de la galería. El botón hamburguesa no
       existe en escritorio y back-top está oculto (visibility) sin scroll. */
    const expectedOrder = [
      { tag: "a", text: "JIMMY." },
      { tag: "a", text: "Portfolio" },
      { tag: "a", text: "Projects" },
      { tag: "a", text: "Mods" },
      { tag: "a", text: "About" },
      { tag: "a", text: "Contact" },
      { tag: "button", id: "gallery-tab-unity" }
    ];
    for (const expected of expectedOrder) {
      await page.keyboard.press("Tab");
      const focus = await focusedElement(page);
      expect(focus.tag).toBe(expected.tag);
      if (expected.text) expect(focus.text).toBe(expected.text);
      if (expected.id) expect(focus.id).toBe(expected.id);
    }
  });

  test("Shift+Tab recorre el mismo orden hacia atrás", async ({ page }) => {
    await openView(page, "portfolio");

    /* Avanza hasta Contact y retrocede hasta el logo. */
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    await expect.poll(async () => (await focusedElement(page)).text).toBe("Contact");

    const backward = ["About", "Mods", "Projects", "Portfolio", "JIMMY."];
    for (const text of backward) {
      await page.keyboard.press("Shift+Tab");
      const focus = await focusedElement(page);
      expect(focus.tag).toBe("a");
      expect(focus.text).toBe(text);
    }
  });

  test("el foco siempre es visible en los controles principales", async ({ page }) => {
    await openView(page, "portfolio");

    /* Outline visible (:focus-visible) en enlaces del menú y pestañas. */
    const navLink = page.locator('#nav a[data-view="mods"]');
    await navLink.focus();
    const navOutline = await navLink.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(navOutline).not.toBe("none");

    const tab = page.locator("#gallery-tab-unity");
    await tab.focus();
    const tabOutline = await tab.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(tabOutline).not.toBe("none");
  });

  test("Enter navega por el menú sin ratón", async ({ page }) => {
    await openView(page, "portfolio");

    await page.locator('#nav a[data-view="contact"]').focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/#contact$/);
    await expect(page.locator("#view-contact")).toBeVisible();
  });

  test("Enter y Espacio activan las tarjetas de la galería", async ({ page }) => {
    await openView(page, "portfolio");

    const card = jsCards(page, "grid-unity").first();
    const dialog = page.locator("#lightbox");

    await card.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await card.focus();
    await page.keyboard.press("Space");
    await expect(dialog).toBeVisible();
  });

  test("Escape cierra el lightbox y devuelve el foco a la tarjeta", async ({ page }) => {
    await openView(page, "portfolio");

    const card = jsCards(page, "grid-unity").first();
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#lightbox")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#lightbox")).toBeHidden();
    await expect(card).toBeFocused();
  });

  test("Enter y Espacio activan el botón de copiar Discord", async ({ page }) => {
    await openView(page, "contact");

    const button = page.locator("#discord-copy");
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#discord-status")).toHaveText(
      "Discord username copied to clipboard."
    );

    await expect(button).toHaveText("jimy1_", { timeout: 10_000 });
    await button.focus();
    await page.keyboard.press("Space");
    await expect(page.locator("#discord-copy")).toHaveText("Copied!");
  });

  test("back-top solo es enfocable cuando es visible", async ({ page }) => {
    await openView(page, "about");

    /* Sin scroll: invisible y fuera del orden de tabulación. */
    await expect(page.locator("#back-top")).toBeHidden();
    await expect(page.locator("#back-top")).not.toBeFocused();

    /* Con scroll: visible, enfocable y activable con Enter. */
    await page.mouse.wheel(0, 1200);
    await expect(page.locator("#back-top")).toBeVisible();
    await page.locator("#back-top").focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 })
      .toBeLessThan(100);
  });
});
