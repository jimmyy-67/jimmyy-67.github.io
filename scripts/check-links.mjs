#!/usr/bin/env node
/**
 * Valida la integridad del sitio estático:
 *   - imágenes, vídeos, iconos y miniaturas declarados en manifest.js;
 *   - recursos de Open Graph/Twitter y favicons;
 *   - recursos locales usados desde HTML y CSS;
 *   - enlaces internos (incluidas anclas y vistas del router) y externos.
 *
 * Uso:
 *   node scripts/check-links.mjs
 *   node scripts/check-links.mjs --skip-external   # comprobación sin red
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const MANIFEST_FILE = path.join(ROOT, "manifest.js");
const SITE_URL = new URL("https://jimmyy-67.github.io/");
const SKIP_EXTERNAL = process.argv.includes("--skip-external");
const UNKNOWN_OPTIONS = process.argv.slice(2).filter((arg) => arg !== "--skip-external");
const EXTERNAL_TIMEOUT_MS = 15_000;
const EXTERNAL_CONCURRENCY = 4;
const EXTERNAL_RETRIES = 2;
const MEDIA_KEYS =
  /^(?:file|fileFallback|image|images|video|videos|thumbnail|thumbnailFallback|poster|icon)$/i;
const LINK_KEYS = /^(?:url|repo|href|link)$/i;
const REMOTE_BLOCK_STATUSES = new Set([401, 403, 406, 418, 429]);
const SKIPPED_PROTOCOLS = new Set(["mailto:", "tel:", "data:", "blob:"]);

const errors = [];
const warnings = [];
const external = new Map();
const checkedLocalFiles = new Set();
const checkedAnchors = new Set();
let manifestAssets = 0;
let metadataAssets = 0;

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const displayPath = (file) => path.relative(ROOT, file).split(path.sep).join("/") || ".";

if (UNKNOWN_OPTIONS.length) {
  console.error(`Opción desconocida: ${UNKNOWN_OPTIONS.join(", ")}`);
  console.error("Uso: node scripts/check-links.mjs [--skip-external]");
  process.exit(2);
}

/** Recorre el sitio sin entrar en directorios de herramientas. */
function findFiles(directory, extension) {
  const ignored = new Set([".git", "node_modules"]);
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...findFiles(fullPath, extension));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) result.push(fullPath);
  }
  return result;
}

/** Tokenizador HTML mínimo que respeta comillas y evita depender de paquetes. */
function parseStartTags(html) {
  const tags = [];
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf("<", cursor);
    if (start === -1) break;
    if (html.startsWith("<!--", start)) {
      const end = html.indexOf("-->", start + 4);
      cursor = end === -1 ? html.length : end + 3;
      continue;
    }

    let index = start + 1;
    if (!/[A-Za-z]/.test(html[index] || "")) {
      cursor = index;
      continue;
    }
    const nameStart = index;
    while (/[\w:-]/.test(html[index] || "")) index += 1;
    const name = html.slice(nameStart, index).toLowerCase();
    let quote = null;
    let end = index;
    for (; end < html.length; end += 1) {
      const char = html[end];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === ">") break;
    }
    if (end >= html.length) break;

    const attributes = new Map();
    const rawAttributes = html.slice(index, end);
    const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const match of rawAttributes.matchAll(attributePattern)) {
      const value = match[2] ?? match[3] ?? match[4] ?? "";
      attributes.set(match[1].toLowerCase(), decodeHtmlEntities(value));
    }
    tags.push({ name, attributes, start });
    cursor = end + 1;
  }
  return tags;
}

function decodeHtmlEntities(value) {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|(amp|quot|apos|lt|gt));/gi,
    (entity, decimal, hex, named) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
      return { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" }[named.toLowerCase()] ?? entity;
    }
  );
}

function publicUrlForFile(file) {
  const relative = displayPath(file).split("/").map(encodeURIComponent).join("/");
  return new URL(relative, SITE_URL);
}

function parseUrl(value, baseUrl, source) {
  const trimmed = String(value).trim();
  if (!trimmed) {
    fail(`${source}: URL o ruta vacía`);
    return null;
  }
  try {
    return new URL(trimmed, baseUrl);
  } catch {
    fail(`${source}: URL no válida: ${value}`);
    return null;
  }
}

function isInsideRoot(file) {
  const relative = path.relative(ROOT, file);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function pathFromLocalUrl(url, source, { page = false } = {}) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    fail(`${source}: la ruta contiene escapes no válidos: ${url.pathname}`);
    return null;
  }

  const siteBase = decodeURIComponent(SITE_URL.pathname);
  if (!pathname.startsWith(siteBase)) {
    fail(`${source}: la URL está fuera de la raíz publicada: ${url.href}`);
    return null;
  }

  const relativeUrlPath = pathname.slice(siteBase.length).replace(/^\/+/, "");
  const rawCandidate = path.resolve(ROOT, relativeUrlPath);
  if (!isInsideRoot(rawCandidate)) {
    fail(`${source}: ruta fuera del sitio: ${url.href}`);
    return null;
  }

  const candidates = [rawCandidate];
  if (page) {
    if (!relativeUrlPath) candidates[0] = path.join(ROOT, "index.html");
    else if (pathname.endsWith("/")) candidates[0] = path.join(rawCandidate, "index.html");
    else if (!path.extname(rawCandidate)) {
      candidates.push(`${rawCandidate}.html`, path.join(rawCandidate, "index.html"));
    }
  }
  return (
    candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ??
    candidates[0]
  );
}

function rememberLocalFile(file, source, originalValue) {
  checkedLocalFiles.add(file);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    fail(`${source}: no existe ${originalValue} (${displayPath(file)})`);
    return false;
  }
  return true;
}

function queueExternal(url, source) {
  const normalized = new URL(url.href);
  normalized.hash = "";
  if (!external.has(normalized.href)) external.set(normalized.href, new Set());
  external.get(normalized.href).add(source);
}

function classifyUrl(value, baseUrl, source) {
  const url = parseUrl(value, baseUrl, source);
  if (!url) return null;
  if (url.protocol === "http:" || url.protocol === "https:") {
    return { url, local: url.origin === SITE_URL.origin };
  }
  if (SKIPPED_PROTOCOLS.has(url.protocol)) return { url, skipped: true };
  fail(`${source}: protocolo no admitido en ${value}`);
  return null;
}

function checkResource(value, baseUrl, source) {
  const result = classifyUrl(value, baseUrl, source);
  if (!result || result.skipped) return;
  if (!result.local) {
    queueExternal(result.url, source);
    return;
  }
  const file = pathFromLocalUrl(result.url, source);
  if (file) rememberLocalFile(file, source, value);
}

const htmlDocuments = new Map();

function readHtmlDocument(file) {
  if (htmlDocuments.has(file)) return htmlDocuments.get(file);
  const html = fs.readFileSync(file, "utf8");
  const tags = parseStartTags(html);
  const ids = new Set();
  const duplicateIds = new Set();
  const namedAnchors = new Set();
  const viewNames = new Set();

  for (const tag of tags) {
    const id = tag.attributes.get("id");
    if (id) {
      if (ids.has(id)) duplicateIds.add(id);
      ids.add(id);
    }
    if (tag.name === "a" && tag.attributes.get("name"))
      namedAnchors.add(tag.attributes.get("name"));
    if (tag.attributes.get("data-view")) viewNames.add(tag.attributes.get("data-view"));
  }
  for (const id of duplicateIds) fail(`${displayPath(file)}: id duplicado #${id}`);

  // El portfolio usa #projects -> #view-projects. Solo se acepta como ruta
  // virtual cuando la vista correspondiente existe físicamente en el HTML.
  const virtualAnchors = new Set([...viewNames].filter((view) => ids.has(`view-${view}`)));
  const document = {
    file,
    html,
    tags,
    ids,
    namedAnchors,
    virtualAnchors,
    url: publicUrlForFile(file)
  };
  htmlDocuments.set(file, document);
  return document;
}

function decodeFragment(hash, source) {
  try {
    return decodeURIComponent(hash.replace(/^#/, "")).split(":~:text=")[0];
  } catch {
    fail(`${source}: ancla con escapes no válidos ${hash}`);
    return null;
  }
}

function checkAnchor(targetFile, url, source) {
  if (!url.hash || url.hash === "#") return;
  const anchor = decodeFragment(url.hash, source);
  if (anchor === null || anchor === "") return;
  const key = `${targetFile}\0${anchor}`;
  if (checkedAnchors.has(key)) return;
  checkedAnchors.add(key);

  if (path.extname(targetFile).toLowerCase() !== ".html") {
    fail(`${source}: ${url.href} usa un ancla sobre un archivo que no es HTML`);
    return;
  }
  const document = readHtmlDocument(targetFile);
  if (
    !document.ids.has(anchor) &&
    !document.namedAnchors.has(anchor) &&
    !document.virtualAnchors.has(anchor)
  ) {
    fail(`${source}: ancla interna inexistente #${anchor} en ${displayPath(targetFile)}`);
  }
}

function checkHyperlink(value, baseUrl, source) {
  const result = classifyUrl(value, baseUrl, source);
  if (!result || result.skipped) return;
  if (!result.local) {
    queueExternal(result.url, source);
    return;
  }
  const targetFile = pathFromLocalUrl(result.url, source, { page: true });
  if (!targetFile || !rememberLocalFile(targetFile, source, value)) return;
  checkAnchor(targetFile, result.url, source);
}

function inspectCss(css, baseUrl, source) {
  const seen = new Set();
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s][^)]*?))\s*\)/gi;
  for (const match of css.matchAll(urlPattern)) {
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!value || value.startsWith("#") || seen.has(value)) continue;
    seen.add(value);
    checkResource(value, baseUrl, source);
  }
  const importPattern = /@import\s+(?!url\()["']([^"']+)["']/gi;
  for (const match of css.matchAll(importPattern)) {
    if (!seen.has(match[1])) checkResource(match[1], baseUrl, source);
  }
}

function inspectManifest() {
  const code = fs.readFileSync(MANIFEST_FILE, "utf8");
  const context = Object.create(null);
  vm.runInNewContext(code, context, { filename: "manifest.js", timeout: 1_000 });
  const manifestUrl = publicUrlForFile(MANIFEST_FILE);

  function inspectMedia(value, key, location) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => inspectMedia(item, key, `${location}[${index}]`));
      return;
    }
    if (typeof value !== "string") {
      fail(`${location}: la ruta multimedia debe ser texto`);
      return;
    }
    let asset = value.trim();
    if (
      key.toLowerCase() === "file" &&
      !asset.startsWith("videos/") &&
      !asset.startsWith("img/") &&
      !asset.startsWith("/") &&
      !asset.startsWith("http")
    ) {
      asset = `img/portfolio/${asset}`;
    }
    manifestAssets += 1;
    checkResource(asset, manifestUrl, location);
  }

  function walk(value, location = "manifest") {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${location}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const childLocation = `${location}.${key}`;
      if (MEDIA_KEYS.test(key)) inspectMedia(child, key, childLocation);
      else if (typeof child === "string" && LINK_KEYS.test(key)) {
        checkHyperlink(child, manifestUrl, childLocation);
      } else walk(child, childLocation);
    }
  }

  walk(context);
}

function inspectJsonLd(document, tag) {
  if (tag.name !== "script" || tag.attributes.get("type")?.toLowerCase() !== "application/ld+json")
    return;
  const openEnd = document.html.indexOf(">", tag.start);
  const closeStart = document.html.indexOf("</script", openEnd + 1);
  if (openEnd === -1 || closeStart === -1) return;
  try {
    const data = JSON.parse(document.html.slice(openEnd + 1, closeStart));
    const walk = (value, key = "", location = "JSON-LD") => {
      if (Array.isArray(value))
        return value.forEach((item, index) => walk(item, key, `${location}[${index}]`));
      if (!value || typeof value !== "object") {
        if (
          typeof value === "string" &&
          /^(?:url|sameAs|image|logo|contentUrl|embedUrl|thumbnailUrl)$/i.test(key)
        ) {
          checkHyperlink(value, document.url, `${displayPath(document.file)} ${location}`);
        }
        return;
      }
      for (const [childKey, child] of Object.entries(value))
        walk(child, childKey, `${location}.${childKey}`);
    };
    walk(data);
  } catch (error) {
    fail(`${displayPath(document.file)}: JSON-LD no válido (${error.message})`);
  }
}

function inspectHtml(document) {
  let openGraphImages = 0;
  let favicons = 0;
  const sourceName = displayPath(document.file);

  for (const tag of document.tags) {
    const attrs = tag.attributes;
    const source = `${sourceName} <${tag.name}>`;

    if (attrs.has("src")) checkResource(attrs.get("src"), document.url, `${source} src`);
    if (attrs.has("poster")) checkResource(attrs.get("poster"), document.url, `${source} poster`);
    if (attrs.has("data-fallback"))
      checkResource(attrs.get("data-fallback"), document.url, `${source} data-fallback`);
    if (tag.name === "object" && attrs.has("data"))
      checkResource(attrs.get("data"), document.url, `${source} data`);
    if (attrs.has("srcset")) {
      for (const candidate of attrs.get("srcset").split(",")) {
        const resource = candidate.trim().split(/\s+/, 1)[0];
        if (resource) checkResource(resource, document.url, `${source} srcset`);
      }
    }
    if (attrs.has("style")) inspectCss(attrs.get("style"), document.url, `${source} style`);

    if (attrs.has("href")) {
      const href = attrs.get("href");
      if (tag.name === "a" || tag.name === "area") {
        if ((attrs.get("target") || "").toLowerCase() === "_blank") {
          const rel = new Set((attrs.get("rel") || "").toLowerCase().split(/\s+/).filter(Boolean));
          if (!rel.has("noopener") || !rel.has("noreferrer")) {
            fail(`${source}: target="_blank" requiere rel="noopener noreferrer"`);
          }
        }
        checkHyperlink(href, document.url, `${source} href`);
      } else if (tag.name === "link") {
        const rel = new Set((attrs.get("rel") || "").toLowerCase().split(/\s+/).filter(Boolean));
        if (rel.has("icon") || rel.has("apple-touch-icon") || rel.has("mask-icon")) {
          favicons += 1;
          metadataAssets += 1;
          checkResource(href, document.url, `${source} favicon`);
        } else if (rel.has("preconnect") || rel.has("dns-prefetch")) {
          // Son sugerencias de conexión, no documentos enlazados.
        } else if (rel.has("canonical") || rel.has("alternate")) {
          checkHyperlink(href, document.url, `${source} href`);
        } else {
          checkResource(href, document.url, `${source} href`);
        }
      }
    }

    if (tag.name === "meta") {
      const metaName = (attrs.get("property") || attrs.get("name") || "").toLowerCase();
      const content = attrs.get("content");
      if (
        /^(?:og:(?:image|video|audio)(?::(?:url|secure_url))?|twitter:image(?::src)?)$/.test(
          metaName
        )
      ) {
        if (metaName.startsWith("og:image")) openGraphImages += 1;
        metadataAssets += 1;
        checkResource(content ?? "", document.url, `${sourceName} ${metaName}`);
      } else if (metaName === "og:url" && content !== undefined) {
        checkHyperlink(content, document.url, `${sourceName} og:url`);
      }
    }

    inspectJsonLd(document, tag);
  }

  if (path.resolve(document.file) === path.join(ROOT, "index.html")) {
    if (openGraphImages === 0) fail("index.html: falta una etiqueta og:image");
    if (favicons === 0) fail('index.html: falta un <link rel="icon">');

    const csp = document.tags
      .find(
        (tag) =>
          tag.name === "meta" &&
          (tag.attributes.get("http-equiv") || "").toLowerCase() === "content-security-policy"
      )
      ?.attributes.get("content");
    if (!csp) fail("index.html: falta la Content-Security-Policy");

    const referrer = document.tags
      .find(
        (tag) =>
          tag.name === "meta" && (tag.attributes.get("name") || "").toLowerCase() === "referrer"
      )
      ?.attributes.get("content");
    if (referrer !== "strict-origin-when-cross-origin") {
      fail("index.html: Referrer-Policy debe ser strict-origin-when-cross-origin");
    }

    const jsonLdPattern =
      /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const match of document.html.matchAll(jsonLdPattern)) {
      const hash = `sha256-${crypto.createHash("sha256").update(match[1]).digest("base64")}`;
      if (csp && !csp.includes(`'${hash}'`)) {
        fail(`index.html: la CSP no permite el JSON-LD actual (${hash})`);
      }
    }
  }
}

function externalSources(sources) {
  const list = [...sources];
  return list.length > 1 ? `${list[0]} (+${list.length - 1} referencias)` : list[0];
}

async function fetchStatus(url, method) {
  const response = await fetch(url, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
    headers: {
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "user-agent": `jimmyy-67-link-checker/1.0 (+${SITE_URL.href})`
    }
  });
  await response.body?.cancel().catch(() => {});
  return response.status;
}

async function checkExternal(url, sources) {
  let lastStatus = null;
  let lastError = null;

  try {
    const status = await fetchStatus(url, "HEAD");
    if (status >= 200 && status < 400) return;
    lastStatus = status;
  } catch (error) {
    lastError = error;
  }

  // Algunos servidores no implementan HEAD o lo bloquean. GET confirma el
  // enlace sin descargar el cuerpo completo (se cancela tras las cabeceras).
  for (let attempt = 1; attempt <= EXTERNAL_RETRIES; attempt += 1) {
    try {
      const status = await fetchStatus(url, "GET");
      lastStatus = status;
      lastError = null;
      if (status >= 200 && status < 400) return;
      if (REMOTE_BLOCK_STATUSES.has(status)) {
        warn(
          `${externalSources(sources)}: ${url} respondió HTTP ${status}; el servidor bloquea comprobaciones automáticas`
        );
        return;
      }
      if (status < 500 && ![408, 425].includes(status)) break;
    } catch (error) {
      lastError = error;
    }
  }

  const source = externalSources(sources);
  if (lastStatus !== null) fail(`${source}: ${url} respondió HTTP ${lastStatus}`);
  else {
    const detail = lastError?.cause?.message || lastError?.message || "error de red";
    fail(`${source}: no se pudo comprobar ${url} (${detail})`);
  }
}

async function runWithConcurrency(entries, concurrency, task) {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (next < entries.length) {
      const current = entries[next];
      next += 1;
      await task(...current);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const htmlFiles = findFiles(ROOT, ".html");
  const cssFiles = findFiles(ROOT, ".css");
  if (!htmlFiles.length) fail("No se encontró ningún archivo HTML");
  if (!fs.existsSync(MANIFEST_FILE)) fail("No existe manifest.js");
  else {
    try {
      inspectManifest();
    } catch (error) {
      fail(`manifest.js: no se pudo cargar (${error.message})`);
    }
  }

  for (const file of htmlFiles) inspectHtml(readHtmlDocument(file));
  for (const file of cssFiles) {
    inspectCss(fs.readFileSync(file, "utf8"), publicUrlForFile(file), displayPath(file));
  }

  if (!SKIP_EXTERNAL) {
    await runWithConcurrency([...external.entries()], EXTERNAL_CONCURRENCY, checkExternal);
  }

  const externalSummary = SKIP_EXTERNAL
    ? `${external.size} externos pendientes (red omitida)`
    : `${external.size} externos comprobados`;
  console.log(
    `Comprobación: ${manifestAssets} assets de manifest, ${metadataAssets} assets de metadatos, ` +
      `${checkedLocalFiles.size} archivos locales, ${checkedAnchors.size} anclas y ${externalSummary}.`
  );
  warnings.forEach((message) => console.warn(`⚠ ${message}`));
  if (errors.length) {
    errors.forEach((message) => console.error(`✗ ${message}`));
    console.error(
      `\nComprobación fallida: ${errors.length} error(es), ${warnings.length} aviso(s).`
    );
    process.exitCode = 1;
  } else {
    console.log(`✓ Integridad correcta${warnings.length ? ` (${warnings.length} aviso(s))` : ""}.`);
  }
}

await main();
