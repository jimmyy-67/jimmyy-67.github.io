#!/usr/bin/env node
/**
 * Genera los medios optimizados del sitio a partir del manifest:
 *
 *   - Imágenes: variantes responsive `-640` / `-1024` en WebP y AVIF para
 *     cada imagen referenciada (galería, proyectos y mods), partiendo del
 *     PNG fuente (fileFallback/thumbnailFallback) cuando existe.
 *   - Logo: variante pequeña `Squid_RED-256.webp` para el header.
 *   - Vídeos: poster estático (`img/posters/<nombre>.webp`, frame al 30%)
 *     y variante móvil `videos/<nombre>-mobile.mp4` (720p desde 1080p,
 *     540p desde 720p).
 *
 * Uso:
 *   node scripts/optimize-media.mjs                    # solo genera lo que falte
 *   node scripts/optimize-media.mjs --force            # regenera imágenes y posters
 *   node scripts/optimize-media.mjs --reencode-videos  # re-comprime los .mp4 completos
 *
 * `--reencode-videos` REEMPLAZA los vídeos originales (con pérdida: H.264
 * CRF 24/23, preset slow, +faststart). Git conserva el original en el
 * historial, pero conviene revisar el resultado antes de publicar.
 *
 * Requisitos: `npm install` (usa sharp) y ffmpeg/ffprobe en PATH (o
 * FFMPEG_BIN / FFPROBE_BIN). Tras tocar medios, actualiza la línea base de
 * pesos: `npm run check:media -- --update-baseline`.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
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

const FORCE = process.argv.includes("--force");
const REENCODE_VIDEOS = process.argv.includes("--reencode-videos");
const IMAGE_RE = /\.(avif|webp|png|jpe?g)$/i;
const VIDEO_RE = /\.(mp4|mov)$/i;
const VARIANT_WIDTHS = [640, 1024];
const KB = 1024;
const MB = 1024 * KB;

const WEBP_QUALITY = 80;
const AVIF_QUALITY = 55;
const AVIF_EFFORT = 4;
const POSTER_WIDTH = 960;
const POSTER_QUALITY = 62;
const POSTER_POSITION = 0.3; // 30% de la duración

const log = [];
const note = (message) => log.push(message);
const humanSize = (bytes) =>
  bytes >= MB ? `${(bytes / MB).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / KB))} KB`;

function run(bin, args, { allowFail = false } = {}) {
  const result = spawnSync(bin, args, { encoding: "utf8", maxBuffer: 64 * MB });
  if (result.error || (!allowFail && result.status !== 0)) {
    const detail = result.error?.message || result.stderr?.trim() || `exit ${result.status}`;
    throw new Error(`${bin} ${args.join(" ")} falló: ${detail}`);
  }
  return result;
}

function whichBin(envName, name) {
  return process.env[envName] || name;
}
const FFMPEG = whichBin("FFMPEG_BIN", "ffmpeg");
const FFPROBE = whichBin("FFPROBE_BIN", "ffprobe");

let sharp;
async function loadSharp() {
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error(
      "Falta sharp: ejecuta `npm install` (o `npm install -D sharp`) antes de optimizar imágenes."
    );
    process.exit(1);
  }
}

/* ---------- utilidades ---------- */
const isRemote = (url) => /^(?:https?:)?\/\//i.test(url);
const stripQuery = (url) => {
  const query = url.indexOf("?");
  return query === -1 ? url : url.slice(0, query);
};
const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");

function manifestSrc(raw) {
  if (!raw) return "";
  return raw.startsWith("videos/") || raw.startsWith("img/") || raw.startsWith("/") || isRemote(raw)
    ? stripQuery(raw)
    : `img/portfolio/${stripQuery(raw)}`;
}

const stemOf = (src) => src.replace(/\.[^./]+$/, "");

async function imageSize(file) {
  const meta = await sharp(file).metadata();
  return { width: meta.width || 0, height: meta.height || 0 };
}

function writeIfChanged(file, buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const previous = fs.existsSync(file) ? fs.statSync(file).size : 0;
  const changed = previous !== buffer.length;
  if (changed) fs.writeFileSync(file, buffer);
  return { file, previous, size: buffer.length, changed };
}

/* ---------- imágenes ---------- */
/* Entradas de imagen del manifest (galería, works y mods). */
function imageEntries() {
  const entries = [];
  for (const items of Object.values(MANIFEST.GALLERY || {})) {
    for (const item of items) {
      const src = manifestSrc(item.file);
      if (src && IMAGE_RE.test(src)) entries.push({ src, item, label: `gallery ${item.title}` });
    }
  }
  for (const list of [MANIFEST.WORKS || [], MANIFEST.MODS || []]) {
    for (const item of list) {
      const src = manifestSrc(item.thumbnail);
      if (src && IMAGE_RE.test(src)) entries.push({ src, item, label: `card ${item.title}` });
    }
  }
  return entries;
}

async function optimizeImages() {
  await loadSharp();
  const results = [];
  const seen = new Set();

  for (const { src, item, label } of imageEntries()) {
    if (isRemote(src) || seen.has(src)) continue;
    seen.add(src);

    const base = path.join(ROOT, src);

    /* Fuente de máxima calidad: el PNG de respaldo si existe. El archivo
       base (.webp) puede no existir todavía: es justo lo que se genera. */
    const fallback = item.fileFallback || item.thumbnailFallback || "";
    const fallbackPath = fallback ? path.join(ROOT, manifestSrc(fallback)) : null;
    const source = fallbackPath && fs.existsSync(fallbackPath) ? fallbackPath : base;
    if (!fs.existsSync(source)) {
      note(`⚠ falta ${src} y su fuente (${label}): no se pueden generar variantes`);
      continue;
    }
    const declaredWidth = item.width;
    const { width: sourceWidth } = await imageSize(source);

    if (!declaredWidth) {
      note(`⚠ ${src} no declara \`width\` en manifest.js (srcset incompleto)`);
      continue;
    }
    if (declaredWidth !== sourceWidth) {
      note(`⚠ ${src}: \`width\` declarado ${declaredWidth} ≠ ${sourceWidth} real (se usa el real)`);
    }
    if (sourceWidth < VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]) {
      note(`⚠ ${src}: la fuente mide ${sourceWidth}px, menor que la variante 1024 (se omite)`);
    }

    const stem = stemOf(src);
    const wanted = [];
    /* WebP completo solo si no existe (los ya publicados no se re-comprimen,
       para no encadenar generación con pérdida). */
    const fullWebp = path.join(ROOT, `${stem}.webp`);
    if (!fs.existsSync(fullWebp) || FORCE) {
      wanted.push({
        file: `${stem}.webp`,
        pipeline: sharp(source).webp({ quality: WEBP_QUALITY })
      });
    }
    if (sourceWidth >= VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]) {
      for (const width of VARIANT_WIDTHS) {
        wanted.push({
          file: `${stem}-${width}.webp`,
          pipeline: sharp(source).resize({ width }).webp({ quality: WEBP_QUALITY })
        });
      }
    }
    /* AVIF en todos los tamaños: es el formato que sirve el navegador moderno. */
    if (IMAGE_RE.test(src) && !src.endsWith(".svg")) {
      wanted.push({
        file: `${stem}.avif`,
        pipeline: sharp(source).avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
      });
      if (sourceWidth >= VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]) {
        for (const width of VARIANT_WIDTHS) {
          wanted.push({
            file: `${stem}-${width}.avif`,
            pipeline: sharp(source)
              .resize({ width })
              .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
          });
        }
      }
    }

    for (const { file, pipeline } of wanted) {
      const target = path.join(ROOT, file);
      if (fs.existsSync(target) && !FORCE) {
        results.push({ file: rel(target), status: "exists", size: fs.statSync(target).size });
        continue;
      }
      const buffer = await pipeline.toBuffer();
      const { size, changed } = writeIfChanged(target, buffer);
      results.push({ file: rel(target), status: changed ? "generated" : "same", size });
    }
  }

  /* Extras estáticos: logo del header en tamaño real de uso. */
  const logo = { source: "img/portfolio/Squid_RED.png", out: "img/portfolio/Squid_RED-256.webp" };
  const logoSource = path.join(ROOT, logo.source);
  if (fs.existsSync(logoSource)) {
    const target = path.join(ROOT, logo.out);
    if (!fs.existsSync(target) || FORCE) {
      const buffer = await sharp(logoSource)
        .resize({ width: 256 })
        .webp({ quality: 85 })
        .toBuffer();
      writeIfChanged(target, buffer);
      results.push({ file: logo.out, status: "generated", size: buffer.length });
    }
  }
  return results;
}

/* ---------- vídeos ---------- */
function videoEntries() {
  const entries = [];
  for (const items of Object.values(MANIFEST.GALLERY || {})) {
    for (const item of items) {
      const src = manifestSrc(item.file);
      if (src && VIDEO_RE.test(src) && !isRemote(src)) {
        entries.push({ src, item, label: `gallery ${item.title}` });
      }
    }
  }
  return entries;
}

function probe(file) {
  const out = run(FFPROBE, [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    file
  ]).stdout;
  const data = JSON.parse(out);
  const video = (data.streams || []).find((s) => s.codec_type === "video") || {};
  const hasAudio = (data.streams || []).some((s) => s.codec_type === "audio");
  return {
    width: Number(video.width) || 0,
    height: Number(video.height) || 0,
    duration: Number(data.format?.duration) || 0,
    hasAudio
  };
}

function encodeVideo(
  input,
  output,
  { crf, maxWidth = null, audioBitrate = null, dropAudio = false }
) {
  const args = ["-y", "-v", "error", "-i", input];
  if (maxWidth) args.push("-vf", `scale=min(iw\\,${maxWidth}):-2`);
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    String(crf),
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart"
  );
  if (dropAudio || !audioBitrate) args.push("-an");
  else args.push("-c:a", "aac", "-b:a", `${audioBitrate}k`);
  args.push(output);
  run(FFMPEG, args);
}

function extractPosterFrame(video, posterPath) {
  const { width, duration } = probe(video);
  const seek = Math.max(0, duration * POSTER_POSITION - 0.1);
  const frame = `${posterPath}.png`;
  run(FFMPEG, ["-y", "-v", "error", "-ss", seek.toFixed(3), "-i", video, "-frames:v", "1", frame]);
  return { frame, width };
}

async function optimizeVideos() {
  const results = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "optmedia-"));
  const seen = new Set();

  for (const { src, label } of videoEntries()) {
    if (seen.has(src)) continue;
    seen.add(src);
    const video = path.join(ROOT, src);
    if (!fs.existsSync(video)) {
      note(`⚠ falta ${src} (${label})`);
      continue;
    }
    const info = probe(video);
    const stem = stemOf(src);

    /* Poster: fotograma representativo en WebP ligero. */
    const poster = path.join(ROOT, "img/posters", `${path.basename(stem)}.webp`);
    if (!fs.existsSync(poster) || FORCE) {
      const { frame, width } = extractPosterFrame(video, path.join(tmp, path.basename(stem)));
      const posterWidth = Math.min(POSTER_WIDTH, width || POSTER_WIDTH);
      const buffer = await sharp(frame)
        .resize({ width: posterWidth, withoutEnlargement: true })
        .webp({ quality: POSTER_QUALITY })
        .toBuffer();
      writeIfChanged(poster, buffer);
      results.push({ file: rel(poster), status: "generated", size: buffer.length });
    } else {
      results.push({ file: rel(poster), status: "exists", size: fs.statSync(poster).size });
    }

    /* Variante móvil: 720p desde 1080p, 540p desde 720p. */
    const mobile = path.join(ROOT, "videos", `${path.basename(stem)}-mobile.mp4`);
    const mobileTarget = info.height > 720 ? 1280 : 960;
    if (!fs.existsSync(mobile) || FORCE) {
      encodeVideo(video, mobile, {
        crf: 26,
        maxWidth: mobileTarget,
        audioBitrate: info.hasAudio ? 64 : null
      });
      results.push({ file: rel(mobile), status: "generated", size: fs.statSync(mobile).size });
    } else {
      results.push({ file: rel(mobile), status: "exists", size: fs.statSync(mobile).size });
    }

    /* Re-compresión con pérdida del vídeo completo (explícita). */
    if (REENCODE_VIDEOS) {
      const before = fs.statSync(video).size;
      const tmpOut = path.join(tmp, `${path.basename(stem)}.mp4`);
      const crf = info.height >= 1080 ? 24 : 23;
      encodeVideo(video, tmpOut, { crf, audioBitrate: info.hasAudio ? 96 : null });
      const after = fs.statSync(tmpOut).size;
      if (after < before) {
        fs.copyFileSync(tmpOut, video);
        results.push({
          file: rel(video),
          status: "reencoded",
          size: after,
          before
        });
      } else {
        note(
          `ℹ ${src}: la re-compresión no mejora (${humanSize(before)} → ${humanSize(after)}), se conserva`
        );
      }
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return results;
}

/* ---------- informe ---------- */
function report(results) {
  console.log("\nMedios generados:");
  for (const r of results.sort((a, b) => a.file.localeCompare(b.file))) {
    const extra = r.before ? ` (antes ${humanSize(r.before)})` : "";
    const mark = r.status === "exists" ? "·" : r.status === "reencoded" ? "⚡" : "✓";
    console.log(`  ${mark} ${r.file.padEnd(52)} ${humanSize(r.size).padStart(9)} ${extra}`);
  }
  const generated = results.filter((r) => r.status !== "exists");
  console.log(
    `\n${generated.length} archivo(s) nuevos o actualizados, ${results.length - generated.length} ya existían.`
  );
  if (log.length) {
    console.log("\nAvisos:");
    for (const message of log) console.log(`  ${message}`);
  }
  console.log(
    "\nSiguiente paso: revisa el resultado y actualiza la línea base de pesos con\n  npm run check:media -- --update-baseline"
  );
}

const images = await optimizeImages();
const videos = await optimizeVideos();
report([...images, ...videos]);
