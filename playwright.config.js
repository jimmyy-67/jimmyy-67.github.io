/* ============================================================================
 * playwright.config.js - configuración de las pruebas E2E
 *
 * Proyectos:
 *   - desktop-chromium: interacción, a11y (axe-core) y condiciones adversas
 *     en escritorio (1280x800). Ejecuta todo excepto tests/mobile/.
 *   - mobile-chromium:  navegación móvil, viewports y a11y móvil, emulando
 *     un Pixel 7 (412x915, táctil). Ejecuta solo tests/mobile/.
 *
 * Servidor web: scripts/serve.mjs sirve el sitio en 127.0.0.1:4173 sin
 * caché. Fuera de CI se reutiliza un servidor ya arrancado, para poder
 * depurar contra el mismo proceso.
 *
 * Entornos sin acceso al CDN de Playwright (p. ej. sandboxes con salida
 * restringida): `E2E_CHROMIUM_EXECUTABLE=/ruta/a/chromium npx playwright test`
 * lanza ese binario en lugar del descargado por `npx playwright install`.
 * ==========================================================================*/
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 4173);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
/* Binario alternativo de Chromium (ver cabecera). Vacío en CI y en local. */
const executablePath = process.env.E2E_CHROMIUM_EXECUTABLE || "";

export default defineConfig({
  testDir: "./tests",
  /* Las pruebas son independientes entre sí: paralelismo completo. */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(executablePath ? { launchOptions: { executablePath } } : {})
  },
  webServer: {
    command: `node scripts/serve.mjs --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      testIgnore: /[/\\]mobile[/\\]/
    },
    {
      name: "mobile-chromium",
      testMatch: /[/\\]mobile[/\\]/,
      use: { ...devices["Pixel 7"] }
    }
  ]
});
