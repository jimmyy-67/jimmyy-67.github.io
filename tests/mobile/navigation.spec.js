/* ============================================================================
 * Navegación móvil: menú hamburguesa (apertura, cierre, navegación y estado
 * ARIA). Se ejecuta en el proyecto mobile-chromium (Pixel 7, 412x915).
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, horizontalOverflow } from "../helpers/site.js";

test.describe("Menú hamburguesa (móvil)", () => {
  test("arranca cerrado y con el botón visible", async ({ page }) => {
    await openView(page, "portfolio");

    const toggle = page.locator(".menu-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#nav")).toBeHidden();
  });

  test("abrir y cerrar con el botón mantiene sincronizados clase y aria-expanded", async ({
    page
  }) => {
    await openView(page, "portfolio");

    const toggle = page.locator(".menu-toggle");
    const nav = page.locator("#nav");

    await toggle.click();
    await expect(nav).toBeVisible();
    await expect(nav).toHaveClass(/open/);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await toggle.click();
    await expect(nav).toBeHidden();
    await expect(nav).not.toHaveClass(/open/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("elegir una sección navega y cierra el panel", async ({ page }) => {
    await openView(page, "portfolio");

    await page.locator(".menu-toggle").click();
    await page.locator('#nav a[data-view="mods"]').click();

    await expect(page).toHaveURL(/#mods$/);
    await expect(page.locator("#view-mods")).toBeVisible();
    await expect(page.locator("#nav")).toBeHidden();
    await expect(page.locator(".menu-toggle")).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape cierra el menú y devuelve el foco al botón", async ({ page }) => {
    await openView(page, "portfolio");

    await page.locator(".menu-toggle").click();
    await expect(page.locator("#nav")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.locator("#nav")).toBeHidden();
    /* El foco vuelve al botón hamburguesa (no tiene id: se comprueba por clase). */
    expect(
      await page.evaluate(() => document.activeElement?.classList.contains("menu-toggle") ?? false)
    ).toBe(true);
  });

  test("un clic fuera del panel también lo cierra", async ({ page }) => {
    await openView(page, "portfolio");

    await page.locator(".menu-toggle").click();
    await expect(page.locator("#nav")).toBeVisible();

    /* Clic en el contenido, lejos del panel (esquina inferior izquierda). */
    await page.mouse.click(20, 800);

    await expect(page.locator("#nav")).toBeHidden();
  });

  test("el menú abierto no provoca desbordamiento horizontal", async ({ page }) => {
    await openView(page, "portfolio");

    await page.locator(".menu-toggle").click();
    await expect(page.locator("#nav")).toBeVisible();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("al cruzar el breakpoint de escritorio el estado del menú se limpia", async ({ page }) => {
    await openView(page, "portfolio");

    await page.locator(".menu-toggle").click();
    await expect(page.locator("#nav")).toBeVisible();

    /* Cambiar a viewport de escritorio debe cerrar el panel. */
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator("#nav")).toBeVisible();
    await expect(page.locator("#nav")).not.toHaveClass(/open/);

    /* Y al volver a móvil sigue cerrado, sin la X marcada. */
    await page.setViewportSize({ width: 412, height: 915 });
    await expect(page.locator(".menu-toggle")).toHaveAttribute("aria-expanded", "false");
  });
});
