/* ============================================================================
 * Condiciones adversas: JavaScript deshabilitado.
 *
 * Sin módulos no hay router ni galería enriquecida, pero el sitio debe
 * seguir siendo utilizable: aviso noscript, navegación estática a las
 * secciones (#view-*), tarjetas de respaldo y enlaces de contacto.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";

test.use({ javaScriptEnabled: false });

const SECTIONS = ["portfolio", "projects", "mods", "about", "contact"];

test.describe("Sin JavaScript", () => {
  test("el aviso noscript y la navegación estática están disponibles", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("body")).toHaveClass(/no-js/);
    await expect(page.locator("body")).not.toHaveClass(/js-ready/);
    await expect(page.getByText(/JavaScript is disabled/)).toBeVisible();

    /* El menú del encabezado sigue visible (aunque sus enlaces # no cambian
       de vista sin router); la navegación estática del aviso sí funciona. */
    const staticNav = page.locator(".no-script-notice nav[aria-label='Static section navigation']");
    await expect(staticNav).toBeVisible();
    await expect(staticNav.locator("a")).toHaveCount(SECTIONS.length);
  });

  test("las cinco secciones se muestran apiladas con contenido de respaldo", async ({ page }) => {
    await page.goto("/");

    for (const section of SECTIONS) {
      const view = page.locator(`#view-${section}`);
      await expect(view).toBeVisible();
    }

    /* Portfolio: tarjetas estáticas con imagen y título. */
    await expect(page.locator("#grid-unity .static-fallback").first()).toBeVisible();
    await expect(page.locator("#view-portfolio img.card-thumb").first()).toBeVisible();

    /* Projects: listado sin JS con los proyectos principales. */
    const projects = page.locator(".nojs-project-item");
    expect(await projects.count()).toBeGreaterThanOrEqual(5);
    await expect(projects.first()).toContainText("Refished");

    /* Mods: tarjetas de respaldo con cifras guardadas. */
    const mods = page.locator("#mods-grid .static-fallback");
    expect(await mods.count()).toBeGreaterThanOrEqual(2);
    await expect(mods.first()).toContainText(/unique downloads/);

    /* Contact: email y usuario de Discord visibles. */
    await expect(page.locator('a[href^="mailto:"]')).toBeVisible();
    await expect(page.locator("#discord-copy")).toHaveText("jimy1_");
  });

  test("las pestañas y controles dependientes de JS no aparecen", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".gallery-tabs")).toBeHidden();
    await expect(page.locator("#projects-rail")).toBeEmpty();
    await expect(page.locator(".projects-rail-wrap")).toBeHidden();
  });

  test("los enlaces estáticos apuntan a las secciones", async ({ page }) => {
    await page.goto("/");

    const links = page.locator(".no-script-notice nav a");
    for (let i = 0; i < SECTIONS.length; i++) {
      await expect(links.nth(i)).toHaveAttribute("href", `#view-${SECTIONS[i]}`);
    }
  });
});
