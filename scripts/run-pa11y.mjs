#!/usr/bin/env node
/**
 * Ejecuta Pa11y CI (análisis WCAG 2 AA con los runners HTML CodeSniffer y
 * axe-core) contra el sitio servido en local por scripts/serve.mjs.
 *
 *   node scripts/run-pa11y.mjs
 *
 * Detalles:
 *   - La configuración vive en .pa11y-ci.json (URLs y defaults). El servidor
 *     se arranca en un puerto efímero y el origen de las URLs se reescribe,
 *     así que el 4173 del archivo es solo legibilidad, no un requisito.
 *   - pa11y-ci NO es dependencia del proyecto (evita que cada `npm ci`
 *     descargue el Chrome de Puppeteer): este wrapper lo importa en caliente
 *     y, si falta, explica cómo instalarlo:
 *
 *       npm install --no-save pa11y-ci
 *
 *   - Entornos sin acceso al CDN de Playwright/Puppeteer (p. ej. sandboxes):
 *     E2E_CHROMIUM_EXECUTABLE=/ruta/a/chromium apunta Pa11y a ese binario,
 *     igual que hace playwright.config.js con la suite de Playwright.
 *
 *   - `defaults.ignore` silencia WCAG2AA.Principle2...NoSuchID: HTML
 *     CodeSniffer no entiende el router por hash del sitio (los enlaces
 *     #portfolio apuntan a vistas gestionadas por js/navigation.js, cuyos
 *     ids reales son view-portfolio, view-projects, ...). El comportamiento
 *     real de esas rutas lo cubren las suites de Playwright y la validación
 *     de anclas de scripts/check-links.mjs.
 */
import { access } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const CONFIG_FILE = path.join(ROOT, ".pa11y-ci.json");

/* pa11y-ci puede quedarse colgado (su promesa no se rechaza si el navegador
   no llega a arrancar): este límite garantiza un fallo ruidoso. */
const PA11Y_TIMEOUT_MS = 5 * 60 * 1000;

function fail(message) {
  console.error(`Pa11y CI falló: ${message}`);
  /* Anotación de GitHub Actions: hace el fallo visible sin abrir los logs. */
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::error title=Pa11y::${String(message).split("\n")[0]}`);
  }
  process.exit(1);
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
  const urls = config.urls || [];
  if (!Array.isArray(urls) || urls.length === 0) {
    fail(".pa11y-ci.json no define ninguna URL (clave `urls`).");
  }

  let pa11yCi;
  try {
    ({ default: pa11yCi } = await import("pa11y-ci"));
  } catch {
    fail(
      "pa11y-ci no está instalado. Instálalo sin tocar package.json:\n" +
        "  npm install --no-save pa11y-ci"
    );
  }

  /* Servidor en puerto efímero: nunca choca con uno ya arrancado. */
  const server = await startServer({ port: 0 });
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  const defaults = { ...(config.defaults || {}) };
  defaults.reporters = ["cli"];
  /* El log por defecto de pa11y-ci es un noop: sin esto el reporter cli no
     imprime el progreso por URL. */
  defaults.log = { error: console.error, info: console.log };

  /* Binario alternativo de Chromium para entornos sin CDN (ver cabecera). */
  if (process.env.E2E_CHROMIUM_EXECUTABLE) {
    const executablePath = path.resolve(process.env.E2E_CHROMIUM_EXECUTABLE);
    try {
      await access(executablePath);
    } catch {
      fail(`E2E_CHROMIUM_EXECUTABLE no existe: ${executablePath}`);
    }
    defaults.chromeLaunchConfig = {
      ...defaults.chromeLaunchConfig,
      executablePath,
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      headless: "shell"
    };
  }

  /* Reescritura del origen de las URLs al puerto real del servidor. */
  const targetUrls = urls.map((url) => url.replace(/^https?:\/\/[^/]+/, origin));

  console.log(`Pa11y CI sobre ${origin} (${targetUrls.length} URLs)…\n`);
  const timeout = setTimeout(() => {
    fail(`sin respuesta de Pa11y en ${PA11Y_TIMEOUT_MS / 1000}s (¿arrancó el navegador?).`);
  }, PA11Y_TIMEOUT_MS);
  timeout.unref?.();
  try {
    const report = await pa11yCi(targetUrls, defaults);
    clearTimeout(timeout);

    /* pa11y-ci registra las URLs cuyo análisis reventó (timeout, cierre del
       navegador...) como "issues" que son errores de ejecución, sin sumarlas
       a report.errors: hay que tratarlas como fallo explícito. */
    const crashed = Object.entries(report.results)
      .filter(([, issues]) => issues.some((issue) => issue instanceof Error))
      .map(([url]) => url);
    for (const url of crashed) {
      console.error(`No se pudo analizar ${url} (error de ejecución de Pa11y).`);
    }

    if (report.errors > 0) {
      console.error(`\nPa11y encontró ${report.errors} error(es) de accesibilidad.`);
      process.exitCode = 2;
    } else if (crashed.length > 0) {
      console.error(`\nPa11y no pudo analizar ${crashed.length} URL(s).`);
      process.exitCode = 2;
    } else {
      console.log(`\nPa11y: ${report.passes}/${report.total} URLs sin errores de accesibilidad.`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  fail(error.stack || error.message);
});
