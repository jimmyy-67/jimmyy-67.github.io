#!/usr/bin/env node
/**
 * Valida los datos editables de manifest.js:
 *   - URLs con formato válido y, salvo --skip-external, accesibles en red;
 *   - categorías de la galería dentro del conjunto conocido;
 *   - archivos de imagen y vídeo referenciados presentes en disco;
 *   - títulos y descripciones no vacíos;
 *   - textos alternativos presentes y descriptivos en cada imagen;
 *   - tipos de media dentro de los formatos permitidos.
 *
 * Uso:
 *   node scripts/validate-manifest.mjs
 *   node scripts/validate-manifest.mjs --skip-external   # validación sin red
 *
 * Devuelve un código de salida distinto de cero si encuentra datos
 * incorrectos, de modo que puede utilizarse en CI.
 */
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
const REMOTE_BLOCK_STATUSES = new Set([401, 403, 406, 418, 429]);

/* Conjuntos conocidos: amplíalos aquí si el sitio gana categorías o formatos. */
const KNOWN_GALLERY_CATEGORIES = new Set(["unity", "godot", "environments"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);
const MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);

const errors = [];
const warnings = [];
const externalUrls = new Map();

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

if (UNKNOWN_OPTIONS.length) {
  console.error(`Opción desconocida: ${UNKNOWN_OPTIONS.join(", ")}`);
  console.error("Uso: node scripts/validate-manifest.mjs [--skip-external]");
  process.exit(2);
}

/** Carga manifest.js igual que el navegador/Node: IIFE sobre globalThis. */
function loadManifest() {
  const code = fs.readFileSync(MANIFEST_FILE, "utf8");
  const context = Object.create(null);
  vm.runInNewContext(code, context, { filename: "manifest.js", timeout: 1_000 });
  return context;
}

/** Texto obligatorio: presente, de tipo string y sin quedarse en blanco. */
function requireText(value, location) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${location}: no puede estar vacío`);
    return false;
  }
  return true;
}

/** URL externa: formato http(s) válido; la accesibilidad se comprueba después. */
function checkUrl(value, location) {
  if (!requireText(value, location)) return;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${location}: "${value}" no es una URL válida`);
    return;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    fail(`${location}: "${value}" debe usar http(s)`);
    return;
  }
  if (!SKIP_EXTERNAL) {
    const sources = externalUrls.get(parsed.href) ?? new Set();
    sources.add(location);
    externalUrls.set(parsed.href, sources);
  }
}

/** Resuelve rutas cortas de la galería igual que js/utils.js en el navegador. */
function resolveMediaSrc(raw) {
  return raw.startsWith("videos/") ||
    raw.startsWith("img/") ||
    raw.startsWith("/") ||
    raw.startsWith("http")
    ? raw
    : `img/portfolio/${raw}`;
}

/** Media local: formato permitido y archivo presente en disco. */
function checkMediaFile(value, location, { allowRemote = false } = {}) {
  if (!requireText(value, location)) return;
  const resolved = resolveMediaSrc(value.trim());

  if (resolved.startsWith("http")) {
    if (allowRemote) checkUrl(resolved, location);
    else fail(`${location}: "${value}" debería ser un archivo local`);
    return;
  }

  const relative = resolved.replace(/^\//, "").split(/[?#]/, 1)[0];
  const extension = path.extname(relative).toLowerCase();
  if (!MEDIA_EXTENSIONS.has(extension)) {
    fail(
      `${location}: formato no permitido "${extension || "(sin extensión)"}" en "${value}" ` +
        `(permitidos: ${[...MEDIA_EXTENSIONS].join(", ")})`
    );
    return;
  }

  const filePath = path.join(ROOT, relative);
  if (!fs.existsSync(filePath)) {
    fail(`${location}: el archivo "${relative}" no existe en disco`);
  } else if (!fs.statSync(filePath).isFile()) {
    fail(`${location}: "${relative}" no es un archivo`);
  }
}

/** Campos responsive de medios (README, «Optimización de medios»):
 *  `width` (ancho real en px del archivo completo), `poster` (miniatura WebP
 *  del vídeo) y `fileFallback` (PNG de respaldo si la variante moderna
 *  falla). Los genera/verifica `npm run optimize:media` y `check:media`;
 *  aquí se valida que lo declarado exista y tenga el formato esperado. */
function checkResponsiveFields(entry, where, { isVideo = false, isLocalImage = false } = {}) {
  if (entry.width !== undefined) {
    if (!Number.isInteger(entry.width) || entry.width <= 0) {
      fail(`${where}.width: "${entry.width}" debe ser un entero positivo (ancho real en px)`);
    }
  } else if (isLocalImage) {
    warn(`${where}.width falta; sin él el navegador no puede aprovechar las variantes responsive`);
  }
  if (entry.poster !== undefined) {
    checkMediaFile(entry.poster, `${where}.poster`);
    if (!/\.webp$/i.test(String(entry.poster).split(/[?#]/, 1)[0])) {
      fail(`${where}.poster: debe ser un WebP (lo genera npm run optimize:media)`);
    }
  } else if (isVideo) {
    warn(`${where}.poster falta; el vídeo no tendrá miniatura antes de reproducir`);
  }
  if (entry.fileFallback !== undefined) {
    checkMediaFile(entry.fileFallback, `${where}.fileFallback`);
  }
}

/** Texto alternativo: obligatorio en imágenes de contenido y descriptivo.
 *  No basta con repetir el nombre del archivo o el título de la tarjeta:
 *  el `alt` tiene que explicar qué se ve en la imagen. */
function requireAltText(value, location, { file = "", title = "" } = {}) {
  if (value === undefined) {
    // Error, no aviso: una imagen de contenido sin alt es una regresión de
    // accesibilidad y debe romper la CI igual que un enlace roto.
    fail(`${location}: falta el texto alternativo de la imagen`);
    return;
  }
  if (!requireText(value, location)) return;
  const alt = value.trim();
  const baseName = path.basename(String(file).split(/[?#]/, 1)[0]);
  if (alt.toLowerCase() === baseName.toLowerCase()) {
    fail(`${location}: el texto alternativo no puede ser el nombre del archivo`);
    return;
  }
  if (title && alt.toLowerCase() === String(title).trim().toLowerCase()) {
    warn(`${location}: el texto alternativo solo repite el título; describe la imagen`);
    return;
  }
  if (alt.length < 20) {
    warn(`${location}: el texto alternativo es demasiado corto para describir la imagen`);
  }
}

function validateWorks(works) {
  if (!Array.isArray(works) || works.length === 0) {
    fail("WORKS: debe ser una lista con al menos un proyecto");
    return;
  }
  works.forEach((work, index) => {
    const where = `WORKS[${index}]${work?.title ? ` (${work.title})` : ""}`;
    if (typeof work !== "object" || work === null) {
      fail(`${where}: cada proyecto debe ser un objeto`);
      return;
    }
    requireText(work.title, `${where}.title`);
    requireText(work.description, `${where}.description`);
    requireText(work.kind, `${where}.kind`);
    checkUrl(work.url, `${where}.url`);
    if (work.linkLabel !== undefined) requireText(work.linkLabel, `${where}.linkLabel`);
    if (work.thumbnail !== undefined) {
      checkMediaFile(work.thumbnail, `${where}.thumbnail`);
      requireAltText(work.thumbnailAlt, `${where}.thumbnailAlt`, {
        file: work.thumbnail,
        title: work.title
      });
      const localThumb = !resolveMediaSrc(String(work.thumbnail)).startsWith("http");
      checkResponsiveFields(work, where, { isLocalImage: localThumb });
    }
    if (work.thumbnailFallback !== undefined)
      checkMediaFile(work.thumbnailFallback, `${where}.thumbnailFallback`);
    if (work.thumbAspect !== undefined && !/^\d+\s*\/\s*\d+$/.test(String(work.thumbAspect))) {
      fail(`${where}.thumbAspect: "${work.thumbAspect}" debe tener el formato "ancho / alto"`);
    }
    if (work.icon !== undefined) checkMediaFile(work.icon, `${where}.icon`);
    if (work.tags !== undefined) {
      if (!Array.isArray(work.tags)) fail(`${where}.tags: debe ser una lista`);
      else work.tags.forEach((tag, i) => requireText(tag, `${where}.tags[${i}]`));
    }
  });
}

function validateMods(mods) {
  if (!Array.isArray(mods) || mods.length === 0) {
    fail("MODS: debe ser una lista con al menos un mod");
    return;
  }
  mods.forEach((mod, index) => {
    const where = `MODS[${index}]${mod?.title ? ` (${mod.title})` : ""}`;
    if (typeof mod !== "object" || mod === null) {
      fail(`${where}: cada mod debe ser un objeto`);
      return;
    }
    requireText(mod.title, `${where}.title`);
    requireText(mod.description, `${where}.description`);
    requireText(mod.game, `${where}.game`);
    checkUrl(mod.url, `${where}.url`);
    if (typeof mod.url === "string" && !/nexusmods\.com\/[^/]+\/mods\/\d+/.test(mod.url)) {
      fail(`${where}.url: "${mod.url}" no apunta a una página de mod de Nexus Mods`);
    }
    if (mod.repo !== undefined) checkUrl(mod.repo, `${where}.repo`);
    if (mod.thumbnail !== undefined) {
      checkMediaFile(mod.thumbnail, `${where}.thumbnail`);
      requireAltText(mod.thumbnailAlt, `${where}.thumbnailAlt`, {
        file: mod.thumbnail,
        title: mod.title
      });
      const localThumb = !resolveMediaSrc(String(mod.thumbnail)).startsWith("http");
      checkResponsiveFields(mod, where, { isLocalImage: localThumb });
    }
    if (mod.thumbnailFallback !== undefined)
      checkMediaFile(mod.thumbnailFallback, `${where}.thumbnailFallback`);
    if (mod.thumbAspect !== undefined && !/^\d+\s*\/\s*\d+$/.test(String(mod.thumbAspect))) {
      fail(`${where}.thumbAspect: "${mod.thumbAspect}" debe tener el formato "ancho / alto"`);
    }
    if (mod.hidden !== undefined && typeof mod.hidden !== "boolean") {
      fail(`${where}.hidden: debe ser true o false`);
    }
    if (mod.stats !== undefined) {
      if (typeof mod.stats !== "object" || mod.stats === null) {
        fail(`${where}.stats: debe ser un objeto`);
      } else {
        for (const key of ["uniqueDownloads", "endorsements"]) {
          const num = mod.stats[key];
          if (num !== undefined && (!Number.isFinite(num) || num < 0)) {
            fail(`${where}.stats.${key}: "${num}" debe ser un número no negativo`);
          }
        }
      }
    }
  });
}

function validateGallery(gallery) {
  if (typeof gallery !== "object" || gallery === null || Array.isArray(gallery)) {
    fail("GALLERY: debe ser un objeto { categoría: [elementos] }");
    return;
  }
  for (const [category, items] of Object.entries(gallery)) {
    if (!KNOWN_GALLERY_CATEGORIES.has(category)) {
      fail(
        `GALLERY: categoría desconocida "${category}" ` +
          `(conocidas: ${[...KNOWN_GALLERY_CATEGORIES].join(", ")})`
      );
    }
    if (!Array.isArray(items) || items.length === 0) {
      fail(`GALLERY.${category}: debe ser una lista con al menos un elemento`);
      continue;
    }
    items.forEach((item, index) => {
      const where = `GALLERY.${category}[${index}]${item?.title ? ` (${item.title})` : ""}`;
      if (typeof item !== "object" || item === null) {
        fail(`${where}: cada elemento debe ser un objeto`);
        return;
      }
      requireText(item.title, `${where}.title`);
      requireText(item.description, `${where}.description`);
      checkMediaFile(item.file, `${where}.file`);
      // Los vídeos no llevan alt: se describen con título y descripción.
      const extension = path.extname(String(item.file ?? "").split(/[?#]/, 1)[0]).toLowerCase();
      const isImage = IMAGE_EXTENSIONS.has(extension);
      const isVideo = VIDEO_EXTENSIONS.has(extension);
      const isLocal = !resolveMediaSrc(String(item.file ?? "")).startsWith("http");
      if (isImage) {
        requireAltText(item.alt, `${where}.alt`, { file: item.file, title: item.title });
      } else if (item.alt !== undefined) {
        warn(`${where}.alt: solo las imágenes usan texto alternativo`);
      }
      checkResponsiveFields(item, where, { isVideo, isLocalImage: isImage && isLocal });
    });
  }
}

function validateNexus(nexus) {
  if (typeof nexus !== "object" || nexus === null) {
    fail("NEXUS: debe ser un objeto con el perfil público");
    return;
  }
  requireText(nexus.profile, "NEXUS.profile");
}

/** Correo electrónico: no es una URL http(s), tiene su propia comprobación. */
function checkEmail(value, location) {
  if (!requireText(value, location)) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())) {
    fail(`${location}: "${value}" no parece una dirección de correo válida`);
  }
}

/** Árbol de textos de interfaz (`SITE.labels`): toda hoja es texto no vacío.
 *  Los módulos de `js/` caen a un valor por defecto si el dato falta, pero un
 *  texto en blanco en el manifest es un error de configuración. */
function validateLabelTree(value, location) {
  if (typeof value === "string") {
    requireText(value, location);
    return;
  }
  if (typeof value !== "object" || value === null) {
    fail(`${location}: debe ser un texto o un objeto con más textos`);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    validateLabelTree(child, `${location}.${key}`);
  }
}

/** Identidad, contacto y redes: datos que aparecen en varias secciones y que
 *  `index.html` marca con `data-site` (lo hidrata `js/site.js` y lo verifica
 *  `scripts/check-links.mjs`). */
function validateSite(site, nexus) {
  if (typeof site !== "object" || site === null) {
    fail("SITE: debe ser un objeto con la identidad, el contacto y las redes");
    return;
  }
  requireText(site.name, "SITE.name");
  requireText(site.author, "SITE.author");
  requireText(site.handle, "SITE.handle");
  requireText(site.description, "SITE.description");
  requireText(site.tagline, "SITE.tagline");
  checkUrl(site.url, "SITE.url");

  const contact = site.contact;
  if (typeof contact !== "object" || contact === null) {
    fail("SITE.contact: debe ser un objeto con email, discordUsername y discordInvite");
  } else {
    checkEmail(contact.email, "SITE.contact.email");
    requireText(contact.discordUsername, "SITE.contact.discordUsername");
    checkUrl(contact.discordInvite, "SITE.contact.discordInvite");
  }

  if (!Array.isArray(site.socials) || site.socials.length === 0) {
    fail("SITE.socials: debe ser una lista con al menos una red");
  } else {
    const keys = new Set();
    site.socials.forEach((social, index) => {
      const where = `SITE.socials[${index}]${social?.key ? ` (${social.key})` : ""}`;
      if (typeof social !== "object" || social === null) {
        fail(`${where}: cada red debe ser un objeto`);
        return;
      }
      requireText(social.key, `${where}.key`);
      requireText(social.label, `${where}.label`);
      checkUrl(social.url, `${where}.url`);
      if (social.key) {
        if (keys.has(social.key)) fail(`${where}.key: clave duplicada "${social.key}"`);
        keys.add(social.key);
      }
    });
  }

  if (site.labels !== undefined) validateLabelTree(site.labels, "SITE.labels");

  /* El enlace al perfil de Nexus se construye con `NEXUS.profile`, que es lo
     que usa el script de estadísticas: si las dos rutas se separan, el pie de
     la sección Mods apuntaría a un sitio distinto del que se consulta. */
  const nexusSocial = (Array.isArray(site.socials) ? site.socials : []).find(
    (social) => social && social.key === "nexusmods"
  );
  const profile = typeof nexus === "object" && nexus !== null ? nexus.profile : null;
  if (nexusSocial && profile) {
    const expected = `https://www.nexusmods.com/profile/${profile}/mods`;
    if (nexusSocial.url !== expected) {
      fail(
        `SITE.socials (nexusmods).url: "${nexusSocial.url}" debería ser "${expected}" ` +
          `(se construye con NEXUS.profile: "${profile}")`
      );
    }
  }
}

/* ===== Accesibilidad de URLs externas (idéntico criterio a check-links) ===== */
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
      "user-agent": `jimmyy-67-manifest-validator/1.0 (+${SITE_URL.href})`
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
  if (!fs.existsSync(MANIFEST_FILE)) {
    fail("No existe manifest.js");
  } else {
    let manifest = null;
    try {
      manifest = loadManifest();
    } catch (error) {
      fail(`manifest.js: no se pudo cargar (${error.message})`);
    }
    if (manifest) {
      validateSite(manifest.SITE, manifest.NEXUS);
      validateWorks(manifest.WORKS);
      validateMods(manifest.MODS);
      validateGallery(manifest.GALLERY);
      validateNexus(manifest.NEXUS);
    }
  }

  if (!SKIP_EXTERNAL && externalUrls.size) {
    await runWithConcurrency([...externalUrls.entries()], EXTERNAL_CONCURRENCY, checkExternal);
  }

  for (const message of warnings) console.warn(`AVISO  ${message}`);
  for (const message of errors) console.error(`ERROR  ${message}`);

  const urlNote = SKIP_EXTERNAL
    ? "URLs validadas solo por formato (--skip-external)"
    : `${externalUrls.size} URL(s) externas comprobadas en red`;
  if (errors.length) {
    console.error(`\nmanifest.js NO es válido: ${errors.length} error(es). ${urlNote}.`);
    process.exit(1);
  }
  console.log(`manifest.js válido. ${urlNote}.`);
}

await main();
