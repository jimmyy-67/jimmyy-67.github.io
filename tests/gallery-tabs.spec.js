/* ============================================================================
 * Pestañas de la galería (#portfolio): filtrado por categoría, estado
 * visual/ARIA y patrón de teclado del rol tablist (js/gallery.js).
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, jsCards } from "./helpers/site.js";

const TABS = [
  { id: "gallery-tab-unity", panel: "gallery-unity", grid: "grid-unity" },
  { id: "gallery-tab-godot", panel: "gallery-godot", grid: "grid-godot" },
  { id: "gallery-tab-environments", panel: "gallery-environments", grid: "grid-environments" }
];

test.describe("Pestañas de la galería", () => {
  test("la pestaña Unity arranca seleccionada y las demás paneles ocultos", async ({ page }) => {
    await openView(page, "portfolio");

    for (const { id, panel } of TABS) {
      const tab = page.locator(`#${id}`);
      const panelEl = page.locator(`#${panel}`);
      if (id === "gallery-tab-unity") {
        await expect(tab).toHaveClass(/active/);
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(tab).toHaveAttribute("tabindex", "0");
        await expect(panelEl).toBeVisible();
      } else {
        await expect(tab).not.toHaveClass(/active/);
        await expect(tab).toHaveAttribute("aria-selected", "false");
        await expect(tab).toHaveAttribute("tabindex", "-1");
        await expect(panelEl).toBeHidden();
      }
    }
  });

  for (const { id, panel, grid } of TABS) {
    test(`filtrar por la categoría ${id.replace("gallery-tab-", "")}`, async ({ page }) => {
      await openView(page, "portfolio");
      await page.locator(`#${id}`).click();

      /* Estado visual y ARIA de la pestaña elegida. */
      const tab = page.locator(`#${id}`);
      await expect(tab).toHaveClass(/active/);
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(tab).toBeFocused();

      /* Solo su panel queda visible. */
      for (const other of TABS.filter((t) => t.id !== id)) {
        await expect(page.locator(`#${other.panel}`)).toBeHidden();
      }
      await expect(page.locator(`#${panel}`)).toBeVisible();

      /* La rejilla se construye bajo demanda y coincide con el contador
         de la pestaña (ambos salen de manifest.js). */
      const expected = Number(await tab.locator(".tab-count").textContent());
      await expect(jsCards(page, grid)).toHaveCount(expected);

      /* La categoría Environments son clips de vídeo. */
      if (id === "gallery-tab-environments") {
        await expect(jsCards(page, grid).locator("video")).toHaveCount(expected);
      }
    });
  }

  test("teclado: flechas, Inicio y Fin siguen el patrón ARIA de pestañas", async ({ page }) => {
    await openView(page, "portfolio");

    await page.locator("#gallery-tab-unity").focus();

    /* Flecha derecha recorre en orden y activa automáticamente. */
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#gallery-tab-godot")).toBeFocused();
    await expect(page.locator("#gallery-tab-godot")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#gallery-godot")).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#gallery-tab-environments")).toBeFocused();
    await expect(page.locator("#gallery-environments")).toBeVisible();

    /* Fin e Inicio saltan a los extremos. */
    await page.keyboard.press("End");
    await expect(page.locator("#gallery-tab-environments")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.locator("#gallery-tab-unity")).toBeFocused();
    await expect(page.locator("#gallery-tab-unity")).toHaveAttribute("aria-selected", "true");

    /* Flecha izquierda desde la primera envuelve a la última. */
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#gallery-tab-environments")).toBeFocused();
    await expect(page.locator("#gallery-tab-environments")).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("los contadores de las pestañas se rellenan al arrancar", async ({ page }) => {
    await openView(page, "portfolio");
    for (const { id } of TABS) {
      const count = await page.locator(`#${id} .tab-count`).textContent();
      expect(Number(count), `contador de ${id}`).toBeGreaterThan(0);
    }
  });
});
