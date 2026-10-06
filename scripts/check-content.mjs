#!/usr/bin/env node
/**
 * Valida el contenido publicado (lo que ven buscadores, redes y lectores de
 * pantalla). Complementa a `check-links.mjs`, que comprueba que los recursos
 * y los enlaces existan; aquí se revisa que además sean correctos:
 *
 *   1. Metadatos Open Graph y Twitter: URLs absolutas, imagen existente con
 *      al menos 1200x630 px y `type`, `width`, `height` y `alt` coherentes
 *      con el archivo real.
 *   2. Textos alternativos: toda imagen del HTML y de manifest.js describe lo
 *      que se ve; `alt=""` queda reservado a las puramente decorativas.
 *   3. Datos estructurados: el JSON-LD declara WebSite, Person y los
 *      CreativeWork de cada proyecto, con nombre, descripción, URL, imagen y
 *      redes sociales que coinciden con la página y con manifest.js.
 *   4. Consistencia: títulos, descripciones, estadísticas, sitemap, robots y
 *      enlaces sociales dicen lo mismo en todos los archivos, y el idioma
 *      declarado en `<html lang>` concuerda con el texto publicado.
 *
 * Uso:
 *   node scripts/check-content.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { parseStartTags, scriptContent, textOfElement } from "./lib/html.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const SITE_URL = new URL("https://jimmyy-67.github.io/");
const INDEX_FILE = path.join(ROOT, "index.html");
const MANIFEST_FILE = path.join(ROOT, "manifest.js");
const SITEMAP_FILE = path.join(ROOT, "sitemap.xml");
const ROBOTS_FILE = path.join(ROOT, "robots.txt");
const STATS_FILE = path.join(ROOT, "stats.json");

/* Mínimo que piden Facebook, LinkedIn, X/Twitter y Discord para la tarjeta
 * grande; por debajo recortan la imagen o la degradan a tarjeta pequeña. */
const MIN_SOCIAL_WIDTH = 1200;
const MIN_SOCIAL_HEIGHT = 630;
const SOCIAL_RATIO_RANGE = [1.5, 2.4];
const SOCIAL_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_ALT_LENGTH = 420; // límite de twitter:image:alt
const MIN_ALT_LENGTH = 25;
/* Un `alt` que solo repite el tipo de archivo no describe nada. */
const GENERIC_ALT =
  /^(?:an?\s+)?(?:image|img|photo|picture|screenshot|logo|icon|banner|thumbnail|media|graphic|imagen|foto|captura|icono|logotipo)s?$/i;
/* Señales de español en textos que deberían ir en inglés (ver `<html lang>`). */
const SPANISH_HINT =
  /[áéíóúñ¿¡]|\b(?:menú|cerrar|vista previa|imagen|página|enlace|proyecto|inicio|siguiente|anterior|descargar|archivo)\b/i;
const USER_FACING_ATTRS = ["alt", "aria-label", "title", "placeholder"];

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const displayPath = (file) => path.relative(ROOT, file).split(path.sep).join("/") || ".";
let checks = 0;
const checked = () => (checks += 1);

/* ===========================================================================
 * Tamaño real de las imágenes, sin dependencias externas: las redes sociales
 * no leen lo que declara el HTML, sino el archivo, así que hay que mirar sus
 * cabeceras (PNG, GIF, WebP en sus tres variantes y JPEG).
 * ======================================================================== */
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
]);

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function jpegSize(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    if (JPEG_SOF_MARKERS.has(marker)) {
      return {
        mime: "image/jpeg",
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return null;
}

function webpSize(buffer) {
  const chunk = buffer.toString("latin1", 12, 16);
  if (chunk === "VP8X") {
    return {
      mime: "image/webp",
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1
    };
  }
  if (chunk === "VP8L" && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return {
      mime: "image/webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }
  if (chunk === "VP8 " && buffer.toString("latin1", 23, 26) === "\x9d\x01\x2a") {
    return {
      mime: "image/webp",
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }
  return null;
}

function imageSize(file) {
  let buffer;
  try {
    buffer = fs.readFileSync(file);
  } catch {
    return null;
  }
  if (buffer.length < 32) return null;
  if (buffer.readUInt32BE(0) === 0x89504e47 && buffer.toString("latin1", 12, 16) === "IHDR") {
    return { mime: "image/png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.toString("latin1", 0, 3) === "GIF") {
    return { mime: "image/gif", width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.toString("latin1", 0, 4) === "RIFF" && buffer.toString("latin1", 8, 12) === "WEBP") {
    return webpSize(buffer);
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return jpegSize(buffer);
  return null;
}

/* ===========================================================================
 * Carga de los archivos del sitio
 * ======================================================================== */
const html = fs.readFileSync(INDEX_FILE, "utf8");
const tags = parseStartTags(html);
const pageTitle = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
const htmlLang = tags.find((tag) => tag.name === "html")?.attributes.get("lang") ?? "";
const pageLinks = new Set(
  tags
    .filter((tag) => tag.name === "a" && tag.attributes.has("href"))
    .map((tag) => tag.attributes.get("href").trim())
);

/** Metadatos por nombre: guarda todas las apariciones para detectar duplicados. */
const metaValues = new Map();
for (const tag of tags) {
  if (tag.name !== "meta") continue;
  const name = (tag.attributes.get("property") || tag.attributes.get("name") || "").toLowerCase();
  if (!name) continue;
  if (!metaValues.has(name)) metaValues.set(name, []);
  metaValues.get(name).push((tag.attributes.get("content") ?? "").trim());
}
const meta = (name) => metaValues.get(name)?.[0] ?? null;

const canonical =
  tags
    .find(
      (tag) =>
        tag.name === "link" &&
        (tag.attributes.get("rel") || "").toLowerCase().split(/\s+/).includes("canonical")
    )
    ?.attributes.get("href")
    ?.trim() ?? null;

const manifest = Object.create(null);
vm.runInNewContext(fs.readFileSync(MANIFEST_FILE, "utf8"), manifest, {
  filename: "manifest.js",
  timeout: 1_000
});
const works = Array.isArray(manifest.WORKS) ? manifest.WORKS : [];
const mods = Array.isArray(manifest.MODS) ? manifest.MODS : [];
const visibleMods = mods.filter((mod) => mod.hidden !== true);
const gallery = manifest.GALLERY && typeof manifest.GALLERY === "object" ? manifest.GALLERY : {};

/* ===========================================================================
 * Utilidades de URL
 * ======================================================================== */
function absoluteUrl(value, source) {
  checked();
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${source}: la URL debe ser absoluta, no relativa (${value})`);
    return null;
  }
  if (url.protocol !== "https:") fail(`${source}: la URL debe usar https (${value})`);
  return url;
}

/** Ruta en disco de una URL propia del sitio (null si apunta fuera). */
function localFile(url) {
  const base = decodeURIComponent(SITE_URL.pathname);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (url.origin !== SITE_URL.origin || !pathname.startsWith(base)) return null;
  const relative = pathname.slice(base.length).replace(/^\/+/, "");
  const file = path.resolve(ROOT, relative);
  return file === ROOT || file.startsWith(`${ROOT}${path.sep}`) ? file : null;
}

/** URL pública absoluta de un recurso del repositorio (sin cache-busting). */
function publicUrl(assetPath) {
  const clean = String(assetPath).trim().split("?")[0].split("#")[0];
  return new URL(clean.split("/").map(encodeURIComponent).join("/"), SITE_URL).href;
}

/* ===========================================================================
 * 1. Metadatos Open Graph y Twitter
 * ======================================================================== */
const REQUIRED_META = [
  "description",
  "og:type",
  "og:site_name",
  "og:locale",
  "og:title",
  "og:description",
  "og:url",
  "og:image",
  "og:image:type",
  "og:image:width",
  "og:image:height",
  "og:image:alt",
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
  "twitter:image:alt"
];

/** Revisa un texto alternativo de metadatos (og:image:alt, twitter:image:alt). */
function checkMetaAlt(name) {
  const value = meta(name);
  if (!value) return;
  checked();
  if (GENERIC_ALT.test(value)) {
    fail(`index.html ${name}: "${value}" no describe la imagen`);
  } else if (value.length < MIN_ALT_LENGTH) {
    warn(`index.html ${name}: descripción muy corta (${value.length} caracteres)`);
  }
  if (value.length > MAX_ALT_LENGTH) {
    fail(`index.html ${name}: ${value.length} caracteres; el máximo admitido es ${MAX_ALT_LENGTH}`);
  }
}

/** Comprueba que una imagen social exista, sea pública y tenga buen tamaño. */
function checkSocialImage(name) {
  const value = meta(name);
  if (!value) return null;
  const url = absoluteUrl(value, `index.html ${name}`);
  if (!url) return null;

  const file = localFile(url);
  if (!file) {
    warn(`index.html ${name}: la imagen es externa (${url.href}); no se puede validar su tamaño`);
    return null;
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    fail(`index.html ${name}: no existe ${displayPath(file)}`);
    return null;
  }

  const size = imageSize(file);
  checked();
  if (!size) {
    fail(
      `index.html ${name}: ${displayPath(file)} no es un formato admitido por las redes ` +
        `(usa JPEG, PNG, WebP o GIF)`
    );
    return null;
  }
  if (!SOCIAL_IMAGE_TYPES.has(size.mime)) {
    fail(`index.html ${name}: ${displayPath(file)} usa ${size.mime}, no admitido en tarjetas`);
  }
  if (size.width < MIN_SOCIAL_WIDTH || size.height < MIN_SOCIAL_HEIGHT) {
    fail(
      `index.html ${name}: ${displayPath(file)} mide ${size.width}x${size.height} px; ` +
        `el mínimo es ${MIN_SOCIAL_WIDTH}x${MIN_SOCIAL_HEIGHT}`
    );
  }
  const ratio = size.width / size.height;
  if (ratio < SOCIAL_RATIO_RANGE[0] || ratio > SOCIAL_RATIO_RANGE[1]) {
    warn(
      `index.html ${name}: proporción ${ratio.toFixed(2)}:1 lejos del 1.91:1 recomendado; ` +
        `las redes recortarán la imagen`
    );
  }
  return { url, file, size };
}

function checkSocialMetadata() {
  for (const name of REQUIRED_META) {
    checked();
    const value = meta(name);
    if (value === null) fail(`index.html: falta <meta ${name}>`);
    else if (!value) fail(`index.html: <meta ${name}> está vacío`);
  }
  for (const [name, values] of metaValues) {
    if (values.length > 1 && !name.startsWith("og:image")) {
      warn(`index.html: <meta ${name}> aparece ${values.length} veces`);
    }
  }

  const ogImage = checkSocialImage("og:image");
  const twitterImage = checkSocialImage("twitter:image");

  if (ogImage) {
    const declared = {
      type: meta("og:image:type"),
      width: Number(meta("og:image:width")),
      height: Number(meta("og:image:height"))
    };
    checked();
    if (declared.type && declared.type !== ogImage.size.mime) {
      fail(
        `index.html og:image:type: declara ${declared.type} pero ` +
          `${displayPath(ogImage.file)} es ${ogImage.size.mime}`
      );
    }
    if (declared.width !== ogImage.size.width || declared.height !== ogImage.size.height) {
      fail(
        `index.html og:image:width/height: declara ${declared.width}x${declared.height} pero ` +
          `${displayPath(ogImage.file)} mide ${ogImage.size.width}x${ogImage.size.height}`
      );
    }
  }
  if (ogImage && twitterImage && ogImage.url.href !== twitterImage.url.href) {
    warn("index.html: og:image y twitter:image usan imágenes distintas");
  }

  checkMetaAlt("og:image:alt");
  checkMetaAlt("twitter:image:alt");

  const ogUrl = meta("og:url");
  if (ogUrl) absoluteUrl(ogUrl, "index.html og:url");
  checked();
  if (!canonical) fail('index.html: falta <link rel="canonical">');
  else {
    absoluteUrl(canonical, "index.html canonical");
    if (ogUrl && ogUrl !== canonical) {
      fail(`index.html: og:url (${ogUrl}) y canonical (${canonical}) no coinciden`);
    }
  }

  const card = meta("twitter:card");
  checked();
  if (card && card !== "summary_large_image") {
    warn(
      `index.html twitter:card: "${card}"; con una imagen 1200x630 se espera summary_large_image`
    );
  }

  const locale = meta("og:locale");
  checked();
  if (
    locale &&
    htmlLang &&
    locale.slice(0, 2).toLowerCase() !== htmlLang.slice(0, 2).toLowerCase()
  ) {
    fail(`index.html: og:locale (${locale}) no concuerda con <html lang="${htmlLang}">`);
  }
}

/* ===========================================================================
 * 2. Textos alternativos
 * ======================================================================== */
function checkAltValue(source, value, { title = "", file = "", requireDetail = true } = {}) {
  checked();
  const alt = value.trim();
  if (!alt) {
    fail(`${source}: texto alternativo vacío (usa alt="" solo en imágenes decorativas)`);
    return;
  }
  if (GENERIC_ALT.test(alt)) {
    fail(`${source}: "${alt}" no describe el contenido de la imagen`);
    return;
  }
  const fileName = path.basename(String(file).split("?")[0]);
  if (fileName && (alt === fileName || alt === fileName.replace(/\.[^.]+$/, ""))) {
    fail(`${source}: el texto alternativo repite el nombre del archivo (${alt})`);
    return;
  }
  if (title && alt.toLowerCase() === title.toLowerCase()) {
    fail(`${source}: el texto alternativo solo repite el título ("${title}")`);
    return;
  }
  // Los iconos del HTML (banderas, logos) se describen en pocas palabras; el
  // mínimo solo se exige al contenido de galería, proyectos y mods.
  if (requireDetail && alt.length < MIN_ALT_LENGTH) {
    warn(`${source}: descripción muy corta (${alt.length} caracteres): "${alt}"`);
  }
}

function checkAltTexts() {
  for (const tag of tags) {
    if (tag.name === "svg") {
      checked();
      const role = (tag.attributes.get("role") || "").toLowerCase();
      const hidden = tag.attributes.get("aria-hidden") === "true";
      const named = tag.attributes.has("aria-label") || tag.attributes.has("aria-labelledby");
      if (role === "img" && !named && !hidden) {
        fail('index.html <svg role="img">: necesita aria-label o aria-hidden="true"');
      }
      continue;
    }
    if (tag.name !== "img") continue;
    checked();
    const src = tag.attributes.get("src") || "";
    if (!tag.attributes.has("alt")) {
      fail(`index.html <img src="${src}">: falta el atributo alt`);
      continue;
    }
    const alt = tag.attributes.get("alt").trim();
    // alt="" es válido: marca una imagen decorativa (iconos junto a su texto).
    if (alt) {
      checkAltValue(`index.html <img src="${src}"> alt`, alt, { file: src, requireDetail: false });
    }
  }

  for (const [category, items] of Object.entries(gallery)) {
    if (!Array.isArray(items)) continue;
    items.forEach((item, index) => {
      const source = `manifest.js GALLERY.${category}[${index}] (${item.file})`;
      if (typeof item.alt !== "string") {
        fail(`${source}: falta "alt" con la descripción de lo que se ve`);
        return;
      }
      checkAltValue(`${source} alt`, item.alt, { title: item.title, file: item.file });
    });
  }

  const describable = [
    ...works.map((work, index) => [`manifest.js WORKS[${index}] (${work.title})`, work]),
    ...mods.map((mod, index) => [`manifest.js MODS[${index}] (${mod.title})`, mod])
  ];
  for (const [source, entry] of describable) {
    if (!entry.thumbnail) continue; // sin miniatura solo hay icono decorativo
    if (typeof entry.thumbnailAlt !== "string") {
      fail(`${source}: falta "thumbnailAlt" con la descripción de la miniatura`);
      continue;
    }
    checkAltValue(`${source} thumbnailAlt`, entry.thumbnailAlt, {
      title: entry.title,
      file: entry.thumbnail
    });
  }
}

/* ===========================================================================
 * 3. Datos estructurados (JSON-LD)
 * ======================================================================== */
function structuredDataNodes() {
  const nodes = [];
  for (const tag of tags) {
    if (tag.name !== "script") continue;
    if ((tag.attributes.get("type") || "").toLowerCase() !== "application/ld+json") continue;
    const raw = scriptContent(html, tag);
    if (raw === null) continue;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      fail(`index.html: JSON-LD no válido (${error.message})`);
      continue;
    }
    const queue = Array.isArray(data) ? [...data] : [data];
    while (queue.length) {
      const node = queue.shift();
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node["@graph"])) queue.push(...node["@graph"]);
      if (node["@type"]) nodes.push(node);
    }
  }
  return nodes;
}

function nodeType(node) {
  return Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
}

function requireFields(node, fields, source) {
  for (const field of fields) {
    checked();
    const value = node[field];
    const empty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && !value.length);
    if (empty) fail(`${source}: falta "${field}"`);
  }
}

function checkStructuredData() {
  const nodes = structuredDataNodes();
  checked();
  if (!nodes.length) {
    fail("index.html: no hay datos estructurados JSON-LD");
    return;
  }

  const website = nodes.find((node) => nodeType(node).includes("WebSite"));
  const person = nodes.find((node) => nodeType(node).includes("Person"));
  checked();
  if (!website) fail("index.html JSON-LD: falta un bloque de tipo WebSite");
  if (!person) fail("index.html JSON-LD: falta un bloque de tipo Person");

  if (website) {
    requireFields(
      website,
      ["name", "url", "description", "image", "inLanguage"],
      "JSON-LD WebSite"
    );
    if (website.url && canonical && website.url !== canonical) {
      fail(`JSON-LD WebSite.url (${website.url}) no coincide con canonical (${canonical})`);
    }
    if (website.name && pageTitle && website.name !== pageTitle) {
      fail(`JSON-LD WebSite.name ("${website.name}") no coincide con <title> ("${pageTitle}")`);
    }
    const description = meta("description");
    if (website.description && description && website.description !== description) {
      fail('JSON-LD WebSite.description no coincide con <meta name="description">');
    }
    const ogImage = meta("og:image");
    if (website.image && ogImage && website.image !== ogImage) {
      fail(`JSON-LD WebSite.image (${website.image}) no coincide con og:image (${ogImage})`);
    }
    if (website.inLanguage && htmlLang && website.inLanguage !== htmlLang) {
      fail(`JSON-LD WebSite.inLanguage (${website.inLanguage}) no coincide con <html lang>`);
    }
  }

  if (person) {
    requireFields(person, ["name", "url", "image", "description", "sameAs"], "JSON-LD Person");
    const sameAs = Array.isArray(person.sameAs) ? person.sameAs : [person.sameAs].filter(Boolean);
    for (const profile of sameAs) {
      checked();
      if (!pageLinks.has(profile)) {
        fail(`JSON-LD Person.sameAs: ${profile} no aparece como enlace en index.html`);
      }
    }
    // El camino inverso: perfiles enlazados en la página que faltan en sameAs.
    const socialPattern =
      /^https:\/\/(?:github\.com\/[^/]+$|j1mmyy\.itch\.io\/$|discord\.gg\/|www\.nexusmods\.com\/profile\/)/;
    for (const href of pageLinks) {
      if (socialPattern.test(href) && !sameAs.includes(href)) {
        warn(`JSON-LD Person.sameAs: falta el perfil enlazado en la página (${href})`);
      }
    }
  }

  // CreativeWork <-> manifest.js: un proyecto nunca debe describirse distinto
  // en la página y en los datos estructurados.
  const byUrl = new Map();
  for (const entry of [...works, ...visibleMods]) {
    if (entry.url) byUrl.set(entry.url, entry);
  }
  const described = new Set();
  for (const node of nodes) {
    if (
      !nodeType(node).some((type) =>
        /^(?:CreativeWork|SoftwareApplication|VideoGame|Game)$/.test(type)
      )
    ) {
      continue;
    }
    const source = `JSON-LD ${node["@type"]} "${node.name ?? "(sin nombre)"}"`;
    requireFields(node, ["name", "description", "url", "image"], source);
    const entry = byUrl.get(node.url);
    checked();
    if (!entry) {
      fail(`${source}: su url (${node.url}) no corresponde a ningún proyecto de manifest.js`);
      continue;
    }
    described.add(entry);
    if (node.name !== entry.title) {
      fail(`${source}: name no coincide con el título de manifest.js ("${entry.title}")`);
    }
    if (node.description !== entry.description) {
      fail(`${source}: description no coincide con la de manifest.js`);
    }
    const allowedImages = [entry.thumbnail, entry.thumbnailFallback].filter(Boolean).map(publicUrl);
    if (allowedImages.length && !allowedImages.includes(node.image)) {
      fail(`${source}: image (${node.image}) no es la miniatura declarada en manifest.js`);
    }
  }
  for (const entry of byUrl.values()) {
    if (entry.thumbnail && !described.has(entry)) {
      warn(`JSON-LD: "${entry.title}" no tiene bloque CreativeWork en index.html`);
    }
  }
}

/* ===========================================================================
 * 4. Consistencia de contenido
 * ======================================================================== */
function checkTextConsistency() {
  checked();
  if (!pageTitle) fail("index.html: falta <title>");
  const ogTitle = meta("og:title");
  const twitterTitle = meta("twitter:title");
  if (ogTitle && pageTitle && ogTitle !== pageTitle) {
    fail(`index.html: og:title ("${ogTitle}") no coincide con <title> ("${pageTitle}")`);
  }
  if (ogTitle && twitterTitle && ogTitle !== twitterTitle) {
    fail("index.html: og:title y twitter:title no coinciden");
  }
  const ogDescription = meta("og:description");
  const twitterDescription = meta("twitter:description");
  if (ogDescription && twitterDescription && ogDescription !== twitterDescription) {
    fail("index.html: og:description y twitter:description no coinciden");
  }
  const siteName = meta("og:site_name");
  if (siteName && pageTitle && siteName !== pageTitle) {
    warn(`index.html: og:site_name ("${siteName}") no coincide con <title> ("${pageTitle}")`);
  }
}

function checkSitemap() {
  checked();
  if (!fs.existsSync(SITEMAP_FILE)) {
    fail("falta sitemap.xml");
    return;
  }
  const xml = fs.readFileSync(SITEMAP_FILE, "utf8");
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  if (!locations.length) {
    fail("sitemap.xml: no declara ninguna URL");
    return;
  }

  const views = new Set(
    tags
      .filter((tag) => tag.attributes.has("data-view"))
      .map((tag) => tag.attributes.get("data-view"))
  );
  const ids = new Set(tags.map((tag) => tag.attributes.get("id")).filter(Boolean));
  const listed = new Set();

  for (const location of locations) {
    const url = absoluteUrl(location, `sitemap.xml <loc>`);
    if (!url) continue;
    if (url.origin !== SITE_URL.origin) {
      fail(`sitemap.xml: ${location} apunta fuera del sitio`);
      continue;
    }
    const fragment = url.hash.replace(/^#/, "");
    if (!fragment) continue;
    listed.add(fragment);
    if (!views.has(fragment) && !ids.has(fragment)) {
      fail(`sitemap.xml: #${fragment} no existe en index.html`);
    }
  }

  checked();
  if (canonical && !locations.includes(canonical)) {
    fail(`sitemap.xml: falta la URL canónica (${canonical})`);
  }
  for (const view of views) {
    if (!listed.has(view)) warn(`sitemap.xml: la vista #${view} de index.html no está listada`);
  }

  checked();
  if (!fs.existsSync(ROBOTS_FILE)) {
    fail("falta robots.txt");
    return;
  }
  const robots = fs.readFileSync(ROBOTS_FILE, "utf8");
  const declared = robots.match(/^\s*Sitemap:\s*(\S+)\s*$/im)?.[1];
  const sitemapUrl = new URL("sitemap.xml", SITE_URL).href;
  if (!declared) fail("robots.txt: falta la línea Sitemap:");
  else if (declared !== sitemapUrl) {
    fail(`robots.txt: Sitemap apunta a ${declared} en lugar de ${sitemapUrl}`);
  }
}

function checkStats() {
  // Las cifras escritas a mano en index.html son el respaldo que se ve cuando
  // stats.json no carga: deben cuadrar con los datos de manifest.js.
  const backupDownloads = visibleMods.reduce(
    (total, mod) => total + Number(mod.stats?.uniqueDownloads ?? 0),
    0
  );
  const shownDownloads = Number((textOfElement(html, "about-dl") ?? "").replace(/[^\d]/g, ""));
  const shownMods = Number((textOfElement(html, "about-mods") ?? "").replace(/[^\d]/g, ""));

  checked();
  if (shownDownloads !== backupDownloads) {
    fail(
      `index.html #about-dl: muestra ${shownDownloads} descargas pero manifest.js suma ` +
        `${backupDownloads}`
    );
  }
  checked();
  if (shownMods !== visibleMods.length) {
    fail(
      `index.html #about-mods: muestra ${shownMods} mods pero manifest.js publica ` +
        `${visibleMods.length}`
    );
  }

  // stats.json lo regenera un workflow a diario: si los respaldos se quedan
  // atrás solo avisamos, nunca se rompe la build por ello.
  if (!fs.existsSync(STATS_FILE)) return;
  let live;
  try {
    live = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
  } catch (error) {
    fail(`stats.json: no es JSON válido (${error.message})`);
    return;
  }
  for (const mod of visibleMods) {
    const id = /nexusmods\.com\/[^/]+\/mods\/(\d+)/.exec(mod.url || "")?.[1];
    if (!id) continue;
    const liveMod = live.mods?.[id];
    checked();
    if (!liveMod) {
      warn(`stats.json: no incluye el mod ${id} (${mod.title})`);
      continue;
    }
    if (Number(liveMod.uniqueDownloads) !== Number(mod.stats?.uniqueDownloads)) {
      warn(
        `manifest.js MODS "${mod.title}": respaldo ${mod.stats?.uniqueDownloads} descargas frente ` +
          `a ${liveMod.uniqueDownloads} en stats.json`
      );
    }
    if (liveMod.version && mod.stats?.version && liveMod.version !== mod.stats.version) {
      warn(
        `manifest.js MODS "${mod.title}": respaldo versión ${mod.stats.version} frente a ` +
          `${liveMod.version} en stats.json`
      );
    }
  }
}

function checkSocialLinks() {
  const profile = manifest.NEXUS?.profile;
  checked();
  if (!profile) {
    fail("manifest.js: falta NEXUS.profile");
  } else {
    const expected = `https://www.nexusmods.com/profile/${encodeURIComponent(profile)}/mods`;
    const link = tags
      .find((tag) => tag.attributes.get("id") === "nexus-profile-link")
      ?.attributes.get("href");
    if (!link) fail("index.html: falta el enlace #nexus-profile-link");
    else if (link !== expected) {
      fail(`index.html #nexus-profile-link: ${link} no coincide con NEXUS.profile (${expected})`);
    }
  }

  // El tamaño de la comunidad se publica en dos sitios: manifest.js y la
  // pastilla de Discord de index.html.
  const discord = works.find((work) => /discord\.gg/.test(work.url || ""));
  const members = discord?.status?.match(/\d[\d.,]*\+?/)?.[0];
  checked();
  if (members && !html.includes(members)) {
    warn(`index.html: la pastilla de Discord no menciona "${members}" como en manifest.js`);
  }
}

function checkLanguage() {
  checked();
  if (!htmlLang) {
    fail("index.html: <html> debe declarar el idioma con lang");
    return;
  }

  // Si hay texto en español dentro de un documento en inglés, hay que marcarlo
  // con lang="es" en su contenedor (o traducirlo).
  for (const tag of tags) {
    if ((tag.attributes.get("lang") || "").toLowerCase().startsWith("es")) continue;
    for (const attribute of USER_FACING_ATTRS) {
      const value = tag.attributes.get(attribute);
      if (value && SPANISH_HINT.test(value)) {
        warn(
          `index.html <${tag.name} ${attribute}>: "${value}" parece español en un documento ` +
            `lang="${htmlLang}"`
        );
      }
    }
  }

  const strings = [];
  const collect = (value, location) => {
    if (typeof value === "string") strings.push([location, value]);
    else if (Array.isArray(value)) value.forEach((item, i) => collect(item, `${location}[${i}]`));
    else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) collect(child, `${location}.${key}`);
    }
  };
  collect(works, "manifest.js WORKS");
  collect(mods, "manifest.js MODS");
  collect(gallery, "manifest.js GALLERY");
  for (const [location, value] of strings) {
    if (value.startsWith("http") || value.startsWith("img/") || value.startsWith("videos/"))
      continue;
    if (SPANISH_HINT.test(value)) {
      warn(`${location}: "${value}" parece español; el contenido publicado va en inglés`);
    }
  }
}

/* ===========================================================================
 * Ejecución
 * ======================================================================== */
checkSocialMetadata();
checkAltTexts();
checkStructuredData();
checkTextConsistency();
checkSitemap();
checkStats();
checkSocialLinks();
checkLanguage();

console.log(
  `Contenido: ${checks} comprobaciones sobre metadatos sociales, textos alternativos, ` +
    `datos estructurados y consistencia.`
);
warnings.forEach((message) => console.warn(`⚠ ${message}`));
if (errors.length) {
  errors.forEach((message) => console.error(`✗ ${message}`));
  console.error(`\nComprobación fallida: ${errors.length} error(es), ${warnings.length} aviso(s).`);
  process.exitCode = 1;
} else {
  console.log(`✓ Contenido coherente${warnings.length ? ` (${warnings.length} aviso(s))` : ""}.`);
}
