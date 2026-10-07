#!/usr/bin/env node
/**
 * Versiones de cache-busting (`?v=N`) de los assets que carga index.html.
 *
 * GitHub Pages sirve HTML/CSS/JS con una caché larga: si el archivo cambia
 * pero su URL no, el visitante recurrente sigue viendo la copia vieja. Por
 * eso las referencias locales de `index.html` llevan `?v=N` y el número sube
 * cada vez que cambia el contenido.
 *
 * Este script:
 *   1. Lista cada asset local referenciado desde index.html y su versión.
 *   2. Avisa de los assets locales que NO llevan `?v=` (quedan sin protección).
 *   3. Con `--since <revisión>` compara las versiones con las de esa revisión
 *      y avisa de los assets cuyo contenido cambió SIN subir el número
 *      (p. ej. tocar `js/gallery.js` sin subir `js/main.js?v=N`). Los módulos
 *      que `js/main.js` importa se resuelven de forma recursiva: basta con
 *      subir la versión del punto de entrada.
 *
 * Uso:
 *   node scripts/check-asset-versions.mjs                       # solo listar
 *   node scripts/check-asset-versions.mjs --since FETCH_HEAD    # detectar cambios
 *   node scripts/check-asset-versions.mjs --since main --strict # fallar en vez de avisar
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const HTML_FILE = path.join(ROOT, "index.html");

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const sinceIndex = args.indexOf("--since");
const SINCE = sinceIndex === -1 ? "" : args[sinceIndex + 1] || "";
const UNKNOWN = args.filter(
  (arg, index) =>
    arg !== "--strict" && index !== sinceIndex && !(sinceIndex !== -1 && index === sinceIndex + 1)
);

if (UNKNOWN.length) {
  console.error(`Opción desconocida: ${UNKNOWN.join(", ")}`);
  console.error("Uso: node scripts/check-asset-versions.mjs [--since <revisión>] [--strict]");
  process.exit(2);
}

const warnings = [];
const errors = [];
const warn = (message) => warnings.push(message);
const fail = (message) => errors.push(message);
const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");

/* ---------- referencias locales de index.html ---------- */

const TAG_RE = /<(?:link|script|img|source|video|audio|iframe)\b[^>]*>/gi;
const ATTR_RE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
/** Recurso al que apunta cada atributo que carga algo. */
const URL_ATTRS = new Set(["href", "src"]);

function attributesOf(tag) {
  const raw = tag.slice(tag.indexOf(" ") + 1).replace(/\/?>$/, "");
  const attributes = new Map();
  for (const match of raw.matchAll(ATTR_RE)) {
    attributes.set(match[1].toLowerCase(), (match[2] ?? match[3] ?? match[4] ?? "").trim());
  }
  return attributes;
}

/** Extrae las rutas de un atributo (srcset admite varias, separadas por comas). */
function urlsIn(value) {
  return value
    .split(",")
    .map((entry) => entry.trim().split(/\s+/)[0])
    .filter(Boolean);
}

const isLocal = (url) => {
  if (!url || url.startsWith("#") || url.startsWith("data:") || url.startsWith("mailto:")) {
    return false;
  }
  return !/^(?:https?:)?\/\//i.test(url);
};

function referencesIn(html) {
  const found = new Map();
  for (const match of html.matchAll(TAG_RE)) {
    const attributes = attributesOf(match[0]);
    for (const attribute of URL_ATTRS) {
      for (const url of urlsIn(attributes.get(attribute) || "")) {
        if (!isLocal(url)) continue;
        const [file, query = ""] = url.split("?");
        if (!file || file.endsWith("/")) continue;
        if (!found.has(file)) {
          found.set(file, { file, version: versionOf(query), query });
        }
      }
    }
  }
  return found;
}

function versionOf(query) {
  const match = /(?:^|&)v=([^&]*)/.exec(query || "");
  return match ? match[1] : null;
}

/* ---------- grupos de archivos que obligan a subir la versión ---------- */

/** Módulos que importa un JS (y los de sus imports), en rutas relativas. */
function importedModules(file, seen = new Set()) {
  const absolute = path.join(ROOT, file);
  if (seen.has(absolute) || !fs.existsSync(absolute)) return seen;
  seen.add(absolute);
  const code = fs.readFileSync(absolute, "utf8");
  for (const match of code.matchAll(/(?:^|\s)(?:import|export)[^'"]*from\s*["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    importedModules(rel(path.resolve(path.dirname(absolute), specifier)), seen);
  }
  return seen;
}

function sourcesFor(file) {
  /* Los módulos de `js/` entran todos por `js/main.js`: tocar cualquiera de
     ellos obliga a subir la versión del punto de entrada, no la de cada
     módulo (los imports internos no llevan `?v=`). */
  if (/\.(?:m?js)$/i.test(file)) {
    return [...importedModules(file)].map(rel).sort();
  }
  return [file];
}

/* ---------- git ---------- */

function git(...gitArgs) {
  try {
    return execFileSync("git", gitArgs, { cwd: ROOT, encoding: "utf8" });
  } catch {
    return "";
  }
}

function changedFilesSince(revision) {
  if (!revision) return null;
  if (!git("rev-parse", "--verify", "--quiet", revision).trim()) {
    console.warn(`⚠ No existe la revisión "${revision}": se omiten las comprobaciones de cambios.`);
    return null;
  }
  /* Sin segundo argumento: compara la revisión con el árbol de trabajo, así
     también se ven los cambios que aún no se han commiteado. */
  return new Set(
    git("diff", "--name-only", revision)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

/* ---------- informe ---------- */

const html = fs.readFileSync(HTML_FILE, "utf8");
const current = referencesIn(html);
const assets = [...current.values()].sort((a, b) => a.file.localeCompare(b.file));

console.log("Versiones de cache-busting (index.html):");
for (const asset of assets) {
  const version = asset.version === null ? "— (sin ?v=)" : `?v=${asset.version}`;
  console.log(`  · ${asset.file.padEnd(34)} ${version}`);
}
const withoutVersion = assets.filter((asset) => asset.version === null);
if (withoutVersion.length) {
  console.log(
    `\n  ${withoutVersion.length} asset(s) sin ?v=: al cambiarlos no hay forma de invalidar la caché ` +
      "(añade ?v=1 en index.html o publica el archivo con otro nombre)."
  );
}

for (const asset of assets) {
  if (asset.version !== null && !/^\d+$/.test(asset.version)) {
    fail(`${asset.file}: la versión "?v=${asset.version}" no es un número entero`);
  }
}

const changed = changedFilesSince(SINCE);
if (changed) {
  console.log(`\nCambios desde ${SINCE}: ${changed.size} archivo(s).`);
  const previousHtml = git("show", `${SINCE}:index.html`);
  const previous = previousHtml ? referencesIn(previousHtml) : new Map();

  for (const asset of assets) {
    const sources = sourcesFor(asset.file);
    const touched = sources.filter((file) => changed.has(file));
    if (touched.length === 0) continue;

    const before = previous.get(asset.file);
    if (!before) {
      console.log(
        `  · ${asset.file}: asset nuevo (añade ?v=1 si quieres poder invalidar su caché).`
      );
      continue;
    }
    if (asset.version === null) {
      warn(
        `${asset.file} cambió (${touched.join(", ")}) y no lleva ?v=: no hay forma de invalidar ` +
          "la caché (añade ?v=1 en index.html o publica el archivo con otro nombre)"
      );
      continue;
    }
    if (before.version === asset.version) {
      warn(
        `${asset.file} sigue en ?v=${asset.version} pero cambiaron ${touched.join(", ")}: ` +
          "sube el número en index.html para que nadie sirva la copia vieja"
      );
    }
  }
  if (changed.has("index.html") && changed.size === 1) {
    console.log("  · index.html cambió sin tocar otros archivos: no hace falta subir versión.");
  }
}

for (const message of warnings) {
  if (process.env.GITHUB_ACTIONS) console.log(`::warning::${message}`);
  else console.warn(`⚠ ${message}`);
}
for (const message of errors) {
  if (process.env.GITHUB_ACTIONS) console.log(`::error::${message}`);
  else console.error(`✗ ${message}`);
}

if (errors.length || (STRICT && warnings.length)) {
  console.error(
    `\nVersiones incorrectas: ${errors.length} error(es), ${warnings.length} aviso(s).`
  );
  process.exit(1);
}
console.log("\n✓ Versiones de cache-busting correctas.");
