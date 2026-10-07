/* ============================================================================
 * Copia del usuario de Discord (js/contact.js): clic (y activación por
 * teclado, al ser un <button> real) con verificación del portapapeles,
 * feedback visible y aviso para lectores de pantalla.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView } from "./helpers/site.js";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.describe("Copia del usuario de Discord", () => {
  test("clic copia jimy1_ al portapapeles y muestra feedback", async ({ page }) => {
    await openView(page, "contact");

    await page.locator("#discord-copy").click();

    await expect(page.locator("#discord-copy")).toHaveText("Copied!");
    await expect(page.locator("#discord-status")).toHaveText(
      "Discord username copied to clipboard."
    );

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe("jimy1_");

    /* El botón recupera el usuario pasados unos segundos. */
    await expect(page.locator("#discord-copy")).toHaveText("jimy1_", { timeout: 10_000 });
  });

  test("Enter activa la copia con el teclado", async ({ page }) => {
    await openView(page, "contact");

    await page.locator("#discord-copy").focus();
    await page.keyboard.press("Enter");

    await expect(page.locator("#discord-status")).toHaveText(
      "Discord username copied to clipboard."
    );
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe("jimy1_");
  });

  test("Espacio activa la copia con el teclado", async ({ page }) => {
    await openView(page, "contact");

    await page.locator("#discord-copy").focus();
    await page.keyboard.press("Space");

    await expect(page.locator("#discord-status")).toHaveText(
      "Discord username copied to clipboard."
    );
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe("jimy1_");
  });

  test("sin Clipboard API sigue habiendo feedback (fallback execCommand)", async ({ browser }) => {
    /* Contexto con navigator.clipboard eliminado: contact.js cae al camino
       heredado (textarea + execCommand). Se comprueba el feedback, que es lo
       verificable sin la API. */
    const context = await browser.newContext({ permissions: ["clipboard-read"] });
    await context.addInitScript(() => {
      delete Navigator.prototype.clipboard;
    });
    const noClipboardPage = await context.newPage();
    await noClipboardPage.goto("/#contact");
    await expect(noClipboardPage.locator("body")).toHaveClass(/js-ready/);

    await noClipboardPage.locator("#discord-copy").click();

    await expect(noClipboardPage.locator("#discord-copy")).toHaveText("Copied!");
    await expect(noClipboardPage.locator("#discord-status")).toHaveText(
      "Discord username copied to clipboard."
    );
    await context.close();
  });
});
