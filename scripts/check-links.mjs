#!/usr/bin/env node
/**
 * Comprueba la integridad del sitio estático sin necesidad de levantar un servidor:
 * - assets multimedia declarados en manifest.js
 * - Open Graph/Twitter images y favicon
 * - anclas internas (incluidas las rutas virtuales del router)
 * - enlaces externos encontrados en index.html y manifest.js
 *
 * Uso: node scripts/check-links.mjs
 *      node scripts/check-links.mjs --skip-external   (para trabajar sin red)
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const HTML_FILE = path.join(ROOT, "index.html");
const SITE_ORIGIN = "https://jimmyy-67.github.io";
const skipExternal = process.argv.includes("--skip-external");
const errors = [];
const warnings = [];
const external = new Map();

const fail = (message) => errors.push(message);
const relativePath = (value) => {
  try {
    const url = new URL(value, SITE_ORIGIN + "/");
    if (url.origin !== SITE_ORIGIN) return null;
    return decodeURIComponent(url.pathname).replace(/^\//, "");
  } catch {
    return null;
  }
};
const cleanAsset = (value) => value.trim().split(/[?#]/, 1)[0];

function checkFile(value, source) {
  const relative = relativePath(value);
  if (relative === null) return;
  const target = path.resolve(ROOT, cleanAsset(relative));
  if (!target.startsWith(ROOT + path.sep) && target !== ROOT) {
    fail(`${source}: ruta fuera del sitio: ${value}`);
  } else if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    fail(`${source}: no existe ${value}`);
  }
}

function queueExternal(value, source) {
  try {
    const url = new URL(value, SITE_ORIGIN + "/");
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (!external.has(url.href)) external.set(url.href, source);
    }
  } catch {
    /* valores como mailto:, javascript: o URLs malformadas no son HTTP */
  }
}

function loadManifest() {
  const code = fs.readFileSync(path.join(ROOT, "manifest.js"), "utf8");
  const context = {};
  vm.runInNewContext(code, context, { filename: "manifest.js" });
  return context;
}

function inspectManifest(manifest) {
  const mediaKeys = /^(file|image|video|thumbnail|thumbnailFallback|poster)$/i;
  const walk = (value, location = "manifest") => {
    if (Array.isArray(value)) return value.forEach((item, i) => walk(item, `${location}[${i}]`));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const where = `${location}.${key}`;
      if (typeof child === "string" && mediaKeys.test(key)) {
        const asset = cleanAsset(child);
        if (/^https?:\/\//i.test(asset)) queueExternal(asset, where);
        else if (asset) {
          // Gallery files without a directory are resolved by script.js under img/portfolio.
          checkFile(
            key === "file" && !/^(?:img|videos)\//.test(asset) ? `img/portfolio/${asset}` : asset,
            where
          );
        }
      } else if (typeof child === "string" && /^(url|repo|href|link)$/i.test(key)) {
        queueExternal(child, where);
      } else walk(child, where);
    }
  };
  walk(manifest);
}

function inspectHtml(html) {
  const ids = new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]));
  const routes = new Set([...html.matchAll(/data-view\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]));

  // Local resources in src/href/poster/data-fallback and local OG/Twitter values.
  for (const match of html.matchAll(/\b(src|href|poster|data-fallback)\s*=\s*["']([^"']+)["']/gi)) {
    const attribute = match[1].toLowerCase();
    const value = match[2];
    if (value.startsWith("#")) {
      const anchor = value.slice(1);
      if (!ids.has(anchor) && !routes.has(anchor))
        fail(`index.html: ancla interna inexistente #${anchor}`);
    } else if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      if (url.origin !== SITE_ORIGIN) queueExternal(value, "index.html");
      // Only resource attributes point to files. A same-site href such as the
      // canonical URL is a page URL, not a file that should be stat'ed.
      else if (attribute !== "href" || /\\.[^/]+$/.test(url.pathname))
        checkFile(value, "index.html");
    } else if (!/^(?:mailto:|tel:|javascript:|data:)/i.test(value)) checkFile(value, "index.html");
  }
  for (const match of html.matchAll(
    /<meta\b[^>]*\b(?:property|name)\s*=\s*["']([^"']+)["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/gi
  )) {
    if (/^(?:og:image|twitter:image)$/i.test(match[1]))
      checkFile(match[2], `${match[1]} (Open Graph/Twitter)`);
  }
  for (const match of html.matchAll(
    /<link\b[^>]*\brel\s*=\s*["']([^"']*\bicon\b[^"']*)["'][^>]*\bhref\s*=\s*["']([^"']+)["']/gi
  )) {
    checkFile(match[2], "favicon");
  }
  // CSS url(...) is also an asset declaration in the published page.
  const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    if (!/^data:/i.test(match[1])) checkFile(match[1], "styles.css");
  }
}

async function checkExternalLinks() {
  if (skipExternal) return;
  const entries = [...external.entries()];
  const results = await Promise.all(
    entries.map(async ([url, source]) => {
      try {
        let response = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(10000)
        });
        if ([403, 405, 500, 501].includes(response.status)) {
          response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: AbortSignal.timeout(10000)
          });
        }
        if (!response.ok) return `${source}: ${url} respondió HTTP ${response.status}`;
      } catch (error) {
        return `${source}: no se pudo comprobar ${url} (${error.message})`;
      }
      return null;
    })
  );
  results.filter(Boolean).forEach(fail);
}

const html = fs.readFileSync(HTML_FILE, "utf8");
try {
  inspectManifest(loadManifest());
} catch (error) {
  fail(`manifest.js: no se pudo cargar (${error.message})`);
}
inspectHtml(html);
await checkExternalLinks();

console.log(
  `Assets y enlaces comprobados: ${external.size} externos${skipExternal ? " (red omitida)" : ""}.`
);
if (warnings.length) warnings.forEach((message) => console.warn(`⚠ ${message}`));
if (errors.length) {
  errors.forEach((message) => console.error(`✗ ${message}`));
  console.error(`\nComprobación fallida: ${errors.length} error(es).`);
  process.exitCode = 1;
} else {
  console.log("✓ Integridad correcta: assets, metadatos, anclas y enlaces externos válidos.");
}
