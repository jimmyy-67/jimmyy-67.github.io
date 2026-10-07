#!/usr/bin/env node
/**
 * Servidor estático mínimo para las pruebas E2E (Playwright y Pa11y).
 *
 * Reproduce lo esencial del comportamiento de GitHub Pages para este sitio:
 * sirve `index.html` en `/`, resuelve archivos dentro del repositorio con el
 * tipo MIME correcto (incluidos AVIF/WebP/MP4) y devuelve 404 para cualquier
 * otra cosa. Sin caché (`Cache-Control: no-store`), de modo que las pruebas
 * que bloquean o sustituyen respuestas (`page.route`) siempre llegan a la
 * red y no a una copia guardada.
 *
 * Uso:
 *   node scripts/serve.mjs                 # http://127.0.0.1:4173
 *   node scripts/serve.mjs --port 8080     # puerto alternativo
 *
 * También exporta `startServer()` para usarlo desde otros scripts
 * (p. ej. `scripts/run-pa11y.mjs`) sin depender de procesos externos.
 */
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

/* Tipos MIME de todos los formatos que usa el sitio (ver scripts/check-media.mjs). */
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webmanifest": "application/manifest+json"
};

/** Sirve el repositorio como sitio estático. Resuelve la promesa al arrancar. */
export function startServer({ port = 4173, host = "127.0.0.1" } = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      /* Solo GET/HEAD y sin salirse de la raíz del repositorio. */
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Method not allowed");
        return;
      }

      const relative = requestPath === "/" ? "index.html" : requestPath.slice(1);
      const filePath = path.normalize(path.join(ROOT, relative));
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }

      const data = await fs.readFile(filePath);
      const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": data.length,
        "Cache-Control": "no-store",
        "Accept-Ranges": "none"
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}

function parsePort(argv) {
  const flag = argv.indexOf("--port");
  if (flag !== -1 && argv[flag + 1]) {
    const port = Number(argv[flag + 1]);
    if (Number.isInteger(port) && port > 0 && port < 65536) return port;
    console.error(`Puerto inválido: ${argv[flag + 1]}`);
    process.exit(1);
  }
  const envPort = Number(process.env.E2E_PORT);
  if (Number.isInteger(envPort) && envPort > 0 && envPort < 65536) return envPort;
  return 4173;
}

/* CLI: `node scripts/serve.mjs` (ver cabecera). */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = parsePort(process.argv);
  startServer({ port })
    .then(() => {
      console.log(`Servidor de pruebas en http://127.0.0.1:${port}`);
    })
    .catch((error) => {
      console.error(`No se pudo arrancar en el puerto ${port}: ${error.message}`);
      process.exit(1);
    });
}
