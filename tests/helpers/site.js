/* ============================================================================
 * tests/helpers/site.js - utilidades comunes de las pruebas E2E
 *
 * - hermetic(): bloquea cualquier petición que no sea al servidor local de
 *   pruebas (fuentes de Google, CDNs externos), de modo que la suite no
 *   dependa de la red ni de terceros y sea rápida y determinista.
 * - openView()/gotoView(): navegan a una vista del router por hash y esperan
 *   a que la aplicación haya arrancado (body.js-ready + vista activa).
 * - trackPageErrors(): recoge errores de JS y de consola locales para poder
 *   exigir rutas sin errores.
 * ==========================================================================*/
import { expect } from "@playwright/test";

export const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";

/** Las cinco vistas del router (js/navigation.js). */
export const VIEWS = ["portfolio", "projects", "mods", "about", "contact"];

const hermeticContexts = new WeakSet();

const isLocalUrl = (url) => {
  try {
    const { hostname } = new URL(url);
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
};

export async function hermetic(page) {
  const context = page.context();
  if (hermeticContexts.has(context)) return;
  hermeticContexts.add(context);
  await context.route("**/*", (route) =>
    isLocalUrl(route.request().url()) ? route.continue() : route.abort()
  );
}

/** Navega a una vista del router sin esperas adicionales. */
export async function gotoView(page, view) {
  await page.goto(`/#${view}`);
}

/** Navega a una vista y espera a que el módulo principal haya arrancado. */
export async function openView(page, view) {
  await hermetic(page);
  await gotoView(page, view);
  await expect(page.locator("body")).toHaveClass(/js-ready/);
  await expect(page.locator(`#view-${view}`)).toBeVisible();
  await expect(page.locator(`#view-${view}`)).toHaveClass(/active/);
}

/**
 * Recoge errores de la página: excepciones de JS (pageerror) y mensajes de
 * consola de tipo error originados en recursos locales. Los recursos
 * externos abortados por hermetic() y sus mensajes de red se ignoran.
 */
export function trackPageErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const url = message.location().url || "";
    /* Solo cuentan los errores de recursos del propio sitio; los de los
       servicios externos abortados a propósito no son fallos del sitio. */
    if (url && !isLocalUrl(url)) return;
    if (/net::ERR_FAILED|ERR_FAILED/.test(message.text()) && !isLocalUrl(url)) return;
    errors.push(`console: ${message.text()} (${url})`);
  });
  return errors;
}

/** Información del elemento con foco, para las pruebas de teclado. */
export function focusedElement(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return { tag: "", id: "", text: "", href: "" };
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      text: (el.textContent || "").trim().slice(0, 80),
      href: el.getAttribute("href") || ""
    };
  });
}

/**
 * Tarjetas construidas por JavaScript dentro de una rejilla: el HTML de
 * respaldo (sin JS) lleva la clase static-fallback y queda oculto en cuanto
 * arranca el módulo principal, así que se excluye de las consultas.
 */
export function jsCards(page, gridId) {
  return page.locator(`#${gridId} .card:not(.static-fallback)`);
}

/**
 * Desbordamiento horizontal del documento en px: 0 (o menos) significa que
 * no aparece scroll lateral.
 */
export function horizontalOverflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
}
