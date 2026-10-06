#!/usr/bin/env node
/**
 * Presupuesto de peso y convenciones de medios para el sitio estático.
 *
 *   - Línea base (`scripts/media-budget.json`): tamaño congelado de cada
 *     archivo ya publicado. Un archivo existente no puede crecer sin
 *     actualizar la línea base a propósito (`--update-baseline`, cambio
 *     visible y revisable en el PR).
 *   - Archivos nuevos: deben entrar en el presupuesto por tipo (imagen,
 *     variante responsive, poster, vídeo, vídeo móvil...).
 *   - Convenciones del manifest: cada imagen local declara `width` correcto
 *     y tiene sus variantes responsive (-640/-1024 en WebP y AVIF); cada
 *     vídeo local tiene poster y variante `-mobile.mp4`.
 *   - Informe de peso total con aviso de CDN si supera el umbral.
 *
 * Uso:
 *   node scripts/check-media.mjs                     # comprobación (CI)
 *   node scripts/check-media.mjs --update-baseline   # re-basar tras un cambio intencional
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
/* Carga manifest.js igual que el navegador: IIFE que publica los datos
   (GALLERY/WORKS/MODS/NEXUS) en el global del contexto. */
function loadManifest() {
  const code = fs.readFileSync(path.join(ROOT, "manifest.js"), "utf8");
  const context = Object.create(null);
  vm.runInNewContext(code, context, { filename: "manifest.js", timeout: 1_000 });
  return context;
}
const MANIFEST = loadManifest();
const BASELINE_FILE = path.join(ROOT, "scripts", "media-budget.json");

const UPDATE_BASELINE = process.argv.includes("--update-baseline");
const KB = 1024;
const MB = 1024 * KB;

/* Presupuesto máximo para archivos NUEVOS (los existentes viven en la línea
   base). Valores pensados para que quepa contenido de calidad sin volver a
   los 100 MB de vídeos de una sola sección. */
const BUDGETS = [
  { test: /-mobile\.mp4$/i, limit: 8 * MB, label: "vídeo móvil" },
  { test: /\.(mp4|mov)$/i, limit: 15 * MB, label: "vídeo" },
  { test: /^img\/posters\//, limit: 80 * KB, label: "poster" },
  { test: /-\d+\.(webp|avif)$/i, limit: 150 * KB, label: "variante responsive" },
  { test: /\.(webp|avif)$/i, limit: 300 * KB, label: "imagen" },
  { test: /\.(png|jpe?g)$/i, limit: 400 * KB, label: "imagen" },
  { test: /\.svg$/i, limit: 25 * KB, label: "icono SVG" },
  { test: /\.ico$/i, limit: 100 * KB, label: "favicon" }
];
const FALLBACK_BUDGET = 100 * KB;

/* Umbral de aviso para plantearse un CDN externo (GitHub Pages recomienda
   sitios < 1 GB; con margen de sobra, 150 MB avisa mucho antes). */
const CDN_WARN_THRESHOLD = 150 * MB;

/* Anchuras de las variantes responsive generadas por optimize-media. */
const VARIANT_WIDTHS = [640, 1024];
const MEDIA_RE = /\.(avif|webp|png|jpe?g|svg|ico|mp4|mov)$/i;
const VIDEO_RE = /\.(mp4|mov)$/i;
const IMAGE_RE = /\.(avif|webp|png|jpe?g)$/i;

const errors = [];
const warnings = [];
const info = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");
const humanSize = (bytes) =>
  bytes >= MB ? `${(bytes / MB).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / KB))} KB`;

const isRemote = (url) => /^(?:https?:)?\/\//i.test(url);

function budgetFor(file) {
  const relative = rel(file);
  for (const { test, limit, label } of BUDGETS) if (test.test(relative)) return { limit, label };
  return { limit: FALLBACK_BUDGET, label: "archivo" };
}

/* ---------- recorrido de medios ---------- */
function walk(directory) {
  const result = [];
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else if (entry.isFile() && MEDIA_RE.test(entry.name)) result.push(full);
  }
  return result;
}

function mediaFiles() {
  const files = [...walk(path.join(ROOT, "img")), ...walk(path.join(ROOT, "videos"))];
  /* Medios sueltos en la raíz (favicons, etc.). */
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.isFile() && MEDIA_RE.test(entry.name)) files.push(path.join(ROOT, entry.name));
  }
  return files;
}

/* ---------- dimensiones reales (PNG / WebP / AVIF) ---------- */
function readDimensions(file) {
  const buf = fs.readFileSync(file);
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (
      buf.length > 30 &&
      buf.toString("latin1", 0, 4) === "RIFF" &&
      buf.toString("latin1", 8, 12) === "WEBP"
    ) {
      let pos = 12;
      while (pos + 8 <= buf.length) {
        const fourcc = buf.toString("latin1", pos, pos + 4);
        const size = buf.readUInt32LE(pos + 4);
        const data = pos + 8;
        if (fourcc === "VP8X")
          return {
            width: 1 + (buf[data + 4] | (buf[data + 5] << 8) | (buf[data + 6] << 16)),
            height: 1 + (buf[data + 7] | (buf[data + 8] << 8) | (buf[data + 9] << 16))
          };
        if (fourcc === "VP8 ")
          return {
            width: buf.readUInt16LE(data + 6) & 0x3fff,
            height: buf.readUInt16LE(data + 8) & 0x3fff
          };
        if (fourcc === "VP8L") {
          const bits = buf.readUInt32LE(data + 1);
          return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
        if (size < 1) break;
        pos = data + size + (size % 2);
      }
      return null;
    }
    if (buf.length > 16 && buf.toString("latin1", 4, 8) === "ftyp") return findAvifSize(buf);
  } catch {
    /* formato inesperado: se avisa y se omite */
  }
  return null;
}

/* AVIF (ISOBMFF): meta -> iprp -> ipco -> ispe. */
function findAvifSize(buf) {
  let pos = 0;
  while (pos + 8 <= buf.length) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    if (size === 0) size = buf.length - pos;
    if (size === 1) size = Number(buf.readBigUInt64BE(pos + 8));
    if (size < 8) break;
    if (type === "meta") return avifSizeInMeta(buf, pos + 8 + 4, pos + size);
    pos += size;
  }
  return null;
}

function avifSizeInMeta(buf, start, end) {
  let pos = start;
  while (pos + 8 <= end) {
    const size = buf.readUInt32BE(pos);
    if (size < 8) break;
    const type = buf.toString("latin1", pos + 4, pos + 8);
    if (type === "iprp") {
      let child = pos + 8;
      while (child + 8 <= pos + size) {
        const childSize = buf.readUInt32BE(child);
        if (childSize < 8) break;
        if (buf.toString("latin1", child + 4, child + 8) === "ipco") {
          let box = child + 8;
          while (box + 8 <= child + childSize) {
            const boxSize = buf.readUInt32BE(box);
            if (boxSize < 8) break;
            if (buf.toString("latin1", box + 4, box + 8) === "ispe") {
              return { width: buf.readUInt32BE(box + 12), height: buf.readUInt32BE(box + 16) };
            }
            box += boxSize;
          }
        }
        child += childSize;
      }
    }
    pos += size;
  }
  return null;
}

/* ---------- comprobaciones de presupuesto ---------- */
function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch (error) {
    fail(`media-budget.json no es JSON válido (${error.message})`);
    return {};
  }
}

function checkBudgets(files, baseline) {
  const current = new Map(files.map((file) => [rel(file), fs.statSync(file).size]));

  for (const [name, size] of current) {
    const frozen = baseline[name];
    if (frozen !== undefined) {
      if (size > frozen) {
        const message =
          `${name}: creció de ${humanSize(frozen)} a ${humanSize(size)}; ` +
          `ajusta la línea base solo si es intencional (npm run check:media -- --update-baseline)`;
        if (UPDATE_BASELINE) warn(message);
        else fail(message);
      } else if (size < frozen * 0.95) {
        info.push(
          `${name}: ahora pesa menos (${humanSize(frozen)} → ${humanSize(size)}); re-basa para fijar el nuevo techo`
        );
      }
    } else {
      const { limit, label } = budgetFor(name);
      if (size > limit) {
        const message = `${name}: ${humanSize(size)} supera el presupuesto de ${label} (${humanSize(limit)})`;
        if (UPDATE_BASELINE) warn(message);
        else fail(message);
      }
    }
  }

  for (const name of Object.keys(baseline)) {
    if (!current.has(name)) info.push(`${name}: desapareció; re-basa la línea base`);
  }
  return current;
}

/* ---------- convenciones del manifest ---------- */
function manifestSrc(raw) {
  if (!raw) return "";
  return raw.startsWith("videos/") || raw.startsWith("img/") || raw.startsWith("/") || isRemote(raw)
    ? raw.split("?")[0]
    : `img/portfolio/${raw.split("?")[0]}`;
}

function imageEntries() {
  const entries = [];
  for (const [category, items] of Object.entries(MANIFEST.GALLERY || {})) {
    for (const item of items) {
      const src = manifestSrc(item.file);
      if (src && IMAGE_RE.test(src)) entries.push({ src, item, where: `GALLERY.${category}` });
    }
  }
  for (const [list, where] of [
    [MANIFEST.WORKS || [], "WORKS"],
    [MANIFEST.MODS || [], "MODS"]
  ]) {
    for (const item of list) {
      const src = manifestSrc(item.thumbnail);
      if (src && IMAGE_RE.test(src)) entries.push({ src, item, where });
    }
  }
  return entries;
}

function videoEntries() {
  const entries = [];
  for (const [category, items] of Object.entries(MANIFEST.GALLERY || {})) {
    for (const item of items) {
      const src = manifestSrc(item.file);
      if (src && VIDEO_RE.test(src) && !isRemote(src)) {
        entries.push({ src, item, where: `GALLERY.${category}` });
      }
    }
  }
  return entries;
}

const stemOf = (src) => src.replace(/\.[^./]+$/, "");

function checkImageConventions() {
  const seen = new Set();
  for (const { src, item, where } of imageEntries()) {
    if (isRemote(src) || seen.has(src)) continue;
    seen.add(src);
    const label = `${where}: ${src}`;

    if (src.endsWith(".png") || src.endsWith(".jpg") || src.endsWith(".jpeg")) {
      fail(`${label}: usa WebP como archivo base (npm run optimize:media) con PNG de respaldo`);
      continue;
    }
    if (!item.width) {
      fail(`${label}: falta \`width\` (ancho real) para el srcset responsive`);
      continue;
    }

    const stem = stemOf(src);
    const required = [
      `${stem}.avif`,
      ...VARIANT_WIDTHS.map((w) => `${stem}-${w}.webp`),
      ...VARIANT_WIDTHS.map((w) => `${stem}-${w}.avif`)
    ];
    for (const relative of required) {
      if (!fs.existsSync(path.join(ROOT, relative))) {
        fail(`${label}: falta la variante ${relative} (npm run optimize:media)`);
      }
    }

    /* El `width` declarado debe coincidir con el archivo real: es lo que
       hace que el navegador elija bien en el srcset. */
    for (const [relative, expected] of [
      [`${stem}.webp`, item.width],
      ...VARIANT_WIDTHS.map((w) => [`${stem}-${w}.webp`, w]),
      ...VARIANT_WIDTHS.map((w) => [`${stem}-${w}.avif`, w])
    ]) {
      const file = path.join(ROOT, relative);
      if (!fs.existsSync(file)) continue;
      const dims = readDimensions(file);
      if (dims && dims.width !== expected) {
        fail(`${relative}: mide ${dims.width}px pero se esperaban ${expected}px`);
      }
      if (!dims) warn(`${relative}: no se pudo leer el tamaño para verificarlo`);
    }
  }
}

function checkVideoConventions() {
  const seen = new Set();
  for (const { src, item, where } of videoEntries()) {
    if (seen.has(src)) continue;
    seen.add(src);
    const stem = stemOf(src);
    const poster = item.poster || `img/posters/${path.basename(stem)}.webp`;
    const mobile = item.mobile || `videos/${path.basename(stem)}-mobile.mp4`;
    const label = `${where}: ${src}`;

    for (const [relative, what] of [
      [poster, "poster"],
      [mobile, "variante móvil"]
    ]) {
      if (isRemote(relative)) continue;
      if (!fs.existsSync(path.join(ROOT, relative))) {
        fail(`${label}: falta la ${what} ${relative} (npm run optimize:media)`);
      }
    }
  }
}

/* ---------- informe ---------- */
function report(current) {
  let total = 0;
  const byKind = new Map();
  for (const [name, size] of current) {
    total += size;
    const kind = name.startsWith("videos/")
      ? name.endsWith("-mobile.mp4")
        ? "vídeos móviles"
        : "vídeos"
      : name.startsWith("img/posters/")
        ? "posters"
        : name.startsWith("img/")
          ? "imágenes"
          : "otros";
    byKind.set(kind, (byKind.get(kind) || 0) + size);
  }

  console.log("Peso de medios:");
  for (const [kind, size] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  · ${kind.padEnd(16)} ${humanSize(size).padStart(10)}`);
  }
  console.log(
    `  · ${"total".padEnd(16)} ${humanSize(total).padStart(10)} en ${current.size} archivos`
  );

  if (total > CDN_WARN_THRESHOLD) {
    warn(
      `el peso total (${humanSize(total)}) supera ${humanSize(CDN_WARN_THRESHOLD)}: plantea alojar los vídeos más pesados en un CDN externo`
    );
  }
}

function main() {
  const files = mediaFiles();
  const baseline = loadBaseline();
  const current = checkBudgets(files, baseline);
  checkImageConventions();
  checkVideoConventions();
  report(current);

  if (UPDATE_BASELINE) {
    const next = {};
    for (const name of [...current.keys()].sort()) next[name] = current.get(name);
    fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(next, null, 2)}\n`);
    console.log(
      `\nLínea base actualizada con ${Object.keys(next).length} archivos (recuerda commit).`
    );
  }

  info.forEach((message) => console.log(`ℹ ${message}`));
  warnings.forEach((message) => console.warn(`⚠ ${message}`));
  if (errors.length) {
    errors.forEach((message) => console.error(`✗ ${message}`));
    console.error(`\nComprobación de medios fallida: ${errors.length} error(es).`);
    process.exitCode = 1;
  } else {
    console.log(`✓ Medios correctos${warnings.length ? ` (${warnings.length} aviso(s))` : ""}.`);
  }
}

main();
