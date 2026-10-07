/* ============================================================================
 * Semántica para lectores de pantalla (NVDA, VoiceOver, Narrador...).
 *
 * No hay forma fiable de automatizar NVDA (Windows) o VoiceOver (macOS) en
 * CI, así que esta suite fija el contrato del que dependen: roles, nombres
 * accesibles, estados ARIA y regiones live que anuncian los cambios. El
 * repaso manual con NVDA/VoiceOver que la complementa está documentado en
 * docs/manual-accessibility-checklist.md.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, jsCards } from "../helpers/site.js";

test.describe("Semántica de lector de pantalla", () => {
  test("el menú principal expone nombre y estado", async ({ page }) => {
    await openView(page, "portfolio");

    /* <nav> nativo: rol implícito de landmark de navegación. */
    await expect(page.getByRole("navigation")).toHaveId("nav");

    /* El botón hamburguesa declara qué controla y si está desplegado. */
    const toggle = page.locator(".menu-toggle");
    await expect(toggle).toHaveAttribute("aria-label", "Main menu");
    await expect(toggle).toHaveAttribute("aria-controls", "nav");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    /* Cada enlace anuncia su destino; el activo, que es la página actual. */
    const active = page.locator('#nav a[data-view="portfolio"]');
    await expect(active).toHaveAttribute("aria-current", "page");
  });

  test("el lightbox es un diálogo con nombre, posición y anuncios en vivo", async ({ page }) => {
    await openView(page, "portfolio");
    await jsCards(page, "grid-unity").first().click();

    const dialog = page.locator("#lightbox");
    await expect(dialog).toBeVisible();

    /* <dialog> nativo: rol implícito de diálogo modal. */
    expect(await dialog.evaluate((el) => el.tagName)).toBe("DIALOG");
    await expect(dialog).toHaveAttribute("aria-labelledby", "lightbox-title");
    await expect(page.locator("#lightbox-title")).toHaveText("Media preview");

    /* Nombre accesible con título y posición ("Image 1 of N"). */
    await expect(dialog).toHaveAttribute("aria-label", /Image 1 of \d+/);

    /* Los cambios de medio se anuncian (región live cortés). */
    await expect(dialog.locator(".lightbox-media")).toHaveAttribute("aria-live", "polite");

    /* Navegación por flechas actualiza el anuncio. */
    await page.keyboard.press("ArrowRight");
    await expect(dialog).toHaveAttribute("aria-label", /Image 2 of \d+/);
  });

  test("las tarjetas de la galería son botones con nombre accesible", async ({ page }) => {
    await openView(page, "portfolio");

    const card = jsCards(page, "grid-unity").first();
    await expect(card).toHaveAttribute("role", "button");
    await expect(card).toHaveAttribute("tabindex", "0");
    await expect(card).toHaveAttribute("aria-label", /.+/);

    /* Las imágenes de contenido llevan texto alternativo descriptivo. */
    await expect(card.locator("img")).toHaveAttribute("alt", /.{10,}/);
  });

  test("las pestañas de galería mantienen la wiring completa del patrón ARIA", async ({ page }) => {
    await openView(page, "portfolio");

    const tablist = page.getByRole("tablist", { name: "Gallery categories" });
    await expect(tablist).toHaveAttribute("aria-label", "Gallery categories");

    for (const id of ["gallery-tab-unity", "gallery-tab-godot", "gallery-tab-environments"]) {
      const tab = page.locator(`#${id}`);
      const controlled = await tab.getAttribute("aria-controls");
      expect(controlled).toBeTruthy();
      await expect(page.locator(`#${controlled}`)).toHaveAttribute("aria-labelledby", id);
      await expect(page.locator(`#${controlled}`)).toHaveAttribute("role", "tabpanel");
    }
  });

  test("el estado de las estadísticas se anuncia como status", async ({ page }) => {
    await openView(page, "mods");

    const status = page.locator("#view-mods [data-stats-status]");
    await expect(status).toHaveAttribute("role", "status");
    await expect(status).toHaveAttribute("aria-live", "polite");
    /* Cuando termina la carga, el mensaje (con fecha) queda anunciado. */
    await expect(status).toContainText(/updated|statistics/i);
  });

  test("la copia de Discord anuncia el resultado en una región live", async ({ page }) => {
    await openView(page, "contact");

    const status = page.locator("#discord-status");
    await expect(status).toHaveAttribute("aria-live", "polite");
    await expect(status).toHaveText("");

    await page.locator("#discord-copy").click();
    await expect(status).toHaveText("Discord username copied to clipboard.");
  });

  test("los iconos decorativos se ocultan a los lectores de pantalla", async ({ page }) => {
    await openView(page, "portfolio");

    /* El logo del encabezado acompaña al texto JIMMY: es decorativo. */
    await expect(page.locator(".logo-img")).toHaveAttribute("alt", "");
    /* Los iconos de las pestañas también (el texto Unity/Godot/... basta). */
    await expect(page.locator("#gallery-tab-unity .tab-glyph")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  test("la estructura de landmarks es estable (instantánea ARIA del menú)", async ({ page }) => {
    await openView(page, "portfolio");

    const snapshot = await page.locator("body").ariaSnapshot();
    expect(snapshot).toContain("- navigation:");
    expect(snapshot).toContain("- main:");
    /* Los cinco enlaces del menú con su nombre accesible. */
    for (const label of ["Portfolio", "Projects", "Mods", "About", "Contact"]) {
      expect(snapshot).toContain(`- link "${label}"`);
    }
  });
});
