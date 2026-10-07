/* ============================================================================
 * Suite de la ruta #projects: el navegador de proyectos (rail de pestañas +
 * escenario) que construye js/projects.js desde manifest.js.
 * ==========================================================================*/
import { test, expect } from "@playwright/test";
import { openView, trackPageErrors } from "../helpers/site.js";

test.describe("Ruta #projects", () => {
  test("muestra la vista Projects con el índice de proyectos", async ({ page }) => {
    await openView(page, "projects");

    const tablist = page.getByRole("tablist", { name: "Project index" });
    await expect(tablist).toBeVisible();
    const tabs = tablist.getByRole("tab");
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(5);

    /* Un panel por proyecto, con el primero seleccionado (Refished). */
    const panels = page.locator("#projects-stage [role='tabpanel']");
    await expect(panels).toHaveCount(count);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(panels.first()).toBeVisible();
    await expect(panels.first().getByRole("heading", { level: 3 })).toContainText("Refished");

    /* El listado estático sin JS queda oculto cuando hay módulos. */
    await expect(page.locator(".nojs-project-list")).toBeHidden();
  });

  test("cambiar de pestaña cambia el panel visible y el estado ARIA", async ({ page }) => {
    await openView(page, "projects");

    const tablist = page.getByRole("tablist", { name: "Project index" });
    const tabs = tablist.getByRole("tab");
    const secondTab = tabs.nth(1);
    const secondTitle = await secondTab.locator(".project-rail-title").textContent();

    await secondTab.click();

    await expect(secondTab).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");
    const panels = page.locator("#projects-stage [role='tabpanel']");
    await expect(panels.nth(1)).toBeVisible();
    await expect(panels.first()).toBeHidden();
    await expect(panels.nth(1).getByRole("heading", { level: 3 })).toContainText(secondTitle);
  });

  test("los enlaces externos de los proyectos abren en otra pestaña de forma segura", async ({
    page
  }) => {
    await openView(page, "projects");

    const links = page.locator("#projects-stage a[target='_blank']");
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      await expect(links.nth(i)).toHaveAttribute("rel", /noopener/);
      await expect(links.nth(i)).toHaveAttribute("rel", /noreferrer/);
    }
  });

  test("la vista carga sin errores de JavaScript ni de consola locales", async ({ page }) => {
    const errors = trackPageErrors(page);
    await openView(page, "projects");
    await expect(page.getByRole("tablist", { name: "Project index" })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
