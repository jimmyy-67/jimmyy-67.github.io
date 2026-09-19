#!/usr/bin/env node
/* ============================================================================
 * fetch-nexus-stats.mjs
 *
 * Recoge las estadísticas reales de los mods desde las DOS APIs públicas de
 * Nexus Mods y las escribe en `stats.json`, que la web lee al cargar.
 *
 *   1) API REST v1 (estable y soportada)  →  una llamada por mod
 *      GET https://api.nexusmods.com/v1/games/{game}/mods/{id}.json
 *      Header: apikey: <NEXUS_API_KEY>
 *      Devuelve `mod_unique_downloads`, `mod_downloads`, `endorsement_count`,
 *      `version` y `updated_time`: lo único que da las descargas únicas POR MOD.
 *
 *   2) API GraphQL v2 (beta, sin autenticar)  →  una sola llamada
 *      POST https://api.nexusmods.com/v2/graphql  (query `userByName`)
 *      Devuelve los totales del PERFIL: `views`, `uniqueModDownloads`,
 *      `kudos`, `modCount`, `recognizedAuthor`, `joined`...
 *      Es la única forma de obtener las visitas de perfil: ni el v1 ni el v3
 *      las exponen. Al ser una API en desarrollo, esta parte es opcional y
 *      best-effort: si falla, el sitio sigue funcionando con los datos del v1.
 *
 * La clave NUNCA se guarda en el repositorio: se pasa como variable de entorno
 * desde el secreto `NEXUS_API_KEY` de GitHub Actions (ver
 * .github/workflows/nexus-stats.yml), no desde el navegador.
 *
 * Uso local:
 *   NEXUS_API_KEY=xxxx node scripts/fetch-nexus-stats.mjs
 *
 * Variables opcionales:
 *   NEXUS_API_BASE          por defecto https://api.nexusmods.com/v1
 *   NEXUS_GRAPHQL_URL       por defecto https://api.nexusmods.com/v2/graphql
 *   NEXUS_ENABLE_GRAPHQL    "false" para desactivar el enriquecido del perfil
 *   NEXUS_APP_NAME          identificador de la app (cabeceras de la petición)
 *   NEXUS_APP_VERSION       versión de la app (cabeceras de la petición)
 *
 * Cabeceras: la API Acceptable Use Policy pide identificar la aplicación con
 * `Application-Name` y `Application-Version`; "sending request metadata which is
 * either blank or impersonates another application" figura como uso inaceptable.
 * Ver https://help.nexusmods.com/article/114-api-acceptable-use-policy
 * ==========================================================================*/
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const API_BASE = (process.env.NEXUS_API_BASE || "https://api.nexusmods.com/v1").replace(/\/+$/, "");
const GRAPHQL_URL = process.env.NEXUS_GRAPHQL_URL || "https://api.nexusmods.com/v2/graphql";
const ENABLE_GRAPHQL = (process.env.NEXUS_ENABLE_GRAPHQL ?? "true").toLowerCase() !== "false";
const API_KEY = process.env.NEXUS_API_KEY;

// Identificación exigida por la AUP de Nexus Mods.
const APP_NAME = process.env.NEXUS_APP_NAME || "jimmyy-67-portfolio";
const APP_VERSION = process.env.NEXUS_APP_VERSION || "1.0.0";
const APP_URL = "https://github.com/jimmyy-67";
const NEXUS_HEADERS = {
  "User-Agent": `${APP_NAME}/${APP_VERSION} (+${APP_URL})`,
  "Application-Name": APP_NAME,
  "Application-Version": APP_VERSION
};

const MANIFEST_PATH = fileURLToPath(new URL("../manifest.js", import.meta.url));
const OUTPUT_PATH = fileURLToPath(new URL("../stats.json", import.meta.url));

if (!API_KEY) {
  console.error(
    "Falta NEXUS_API_KEY.\n" +
      "Genera una clave en https://www.nexusmods.com/users/myaccount?tab=api y guárdala como\n" +
      "secreto del repositorio (Settings → Secrets and variables → Actions → NEXUS_API_KEY)."
  );
  process.exit(1);
}

/* --- 1. Leer la configuración desde manifest.js --------------------------- */
// manifest.js se asigna a `globalThis` cuando no hay `window`, así que basta
// con importarlo para tener MODS y NEXUS disponibles en Node.
await import(MANIFEST_PATH);
const mods = Array.isArray(globalThis.MODS) ? globalThis.MODS : [];
const profileName = globalThis.NEXUS?.profile || null;

const targets = mods
  .map((mod) => {
    const match = /nexusmods\.com\/([^/]+)\/mods\/(\d+)/.exec(mod.url || "");
    if (!match) return null;
    return { id: Number(match[2]), game: match[1], title: mod.title || `mod ${match[2]}` };
  })
  .filter(Boolean);

if (!targets.length) {
  console.error("No he encontrado ninguna URL de Nexus Mods en window.MODS (manifest.js).");
  process.exit(1);
}

/* --- 2. Utilidades -------------------------------------------------------- */
function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toIso(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    // La API v1 devuelve segundos; si el número ya viene en milisegundos, se respeta.
    return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  }
  const parsed = Date.parse(String(value).replace(" +0000", "Z").replace(/ \+(\d{2}):?(\d{2})$/, "+$1:$2"));
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

async function readPrevious() {
  try {
    const parsed = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    return parsed && typeof parsed === "object" && parsed.mods ? parsed : null;
  } catch {
    return null;
  }
}

const previous = await readPrevious();

/* --- 3. API REST v1: estadísticas por mod (fuente principal) -------------- */
const modsStats = {};
let ok = 0;
let failed = 0;

for (const target of targets) {
  const key = String(target.id);
  const endpoint = `${API_BASE}/games/${target.game}/mods/${target.id}.json`;
  try {
    const res = await fetch(endpoint, {
      headers: {
        ...NEXUS_HEADERS,
        apikey: API_KEY,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) {
      const body = (await res.text()).slice(0, 200).replace(/\s+/g, " ").trim();
      throw new Error(`HTTP ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`);
    }

    const data = await res.json();
    modsStats[key] = {
      id: target.id,
      game: target.game,
      name: data.name || target.title,
      version: data.version ?? null,
      uniqueDownloads: toInt(data.mod_unique_downloads),
      totalDownloads: toInt(data.mod_downloads),
      endorsements: toInt(data.endorsement_count),
      updatedAt: toIso(data.updated_time ?? data.updated_timestamp),
      fetchedAt: new Date().toISOString(),
      url: `https://www.nexusmods.com/${target.game}/mods/${target.id}`
    };
    ok += 1;
    console.log(
      `✓ [v1] ${target.id} ${target.title}: ${modsStats[key].uniqueDownloads} descargas únicas, ` +
        `${modsStats[key].endorsements} endorsements, v${modsStats[key].version}`
    );
  } catch (error) {
    failed += 1;
    // Si el mod borró o la API falla, conservamos el último dato bueno conocido.
    if (previous?.mods?.[key]) {
      modsStats[key] = previous.mods[key];
      console.error(`✗ [v1] ${target.id} ${target.title}: ${error.message} (se conserva el dato anterior)`);
    } else {
      console.error(`✗ [v1] ${target.id} ${target.title}: ${error.message}`);
    }
  }
}

if (ok === 0) {
  console.error("Ninguna consulta al v1 ha funcionado: no se toca stats.json.");
  process.exit(1);
}

/* --- 4. API GraphQL v2: totales del perfil (best-effort) ------------------ */
// No consume la cuota del v1 (que son 2.500 peticiones/día), pero es una API
// en desarrollo: si algo cambia o falla, el script no se rompe.
const PROFILE_QUERY = `query ProfileSummary($name: String!) {
  userByName(name: $name) {
    name
    memberId
    views
    kudos
    uniqueModDownloads
    modCount
    recognizedAuthor
    joined
    lastActive
  }
}`;

let profile = previous?.profile || null;

async function fetchProfile(name) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      ...NEXUS_HEADERS,
      "content-type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      query: PROFILE_QUERY,
      variables: { name },
      operationName: "ProfileSummary"
    }),
    signal: AbortSignal.timeout(20000)
  });

  // Se lee el cuerpo antes de mirar el status: GraphQL devuelve los errores de
  // validación (p. ej. un campo renombrado) en el JSON, y ese mensaje es el que
  // de verdad explica qué ha cambiado.
  const json = await res.json().catch(() => null);
  if (json?.errors?.length) throw new Error(json.errors[0]?.message || "error de GraphQL");
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const user = json?.data?.userByName;
  if (!user) throw new Error("userByName no devolvió datos (¿perfil inexistente o campo restringido?)");

  return {
    source: "GraphQL API v2 (beta) - https://api.nexusmods.com/v2/graphql",
    ok: true,
    error: null,
    name: user.name ?? name,
    memberId: toInt(user.memberId),
    profileViews: toInt(user.views),
    uniqueDownloads: toInt(user.uniqueModDownloads),
    kudos: toInt(user.kudos),
    modCount: toInt(user.modCount),
    recognizedAuthor: user.recognizedAuthor === true,
    joined: toIso(user.joined),
    lastActive: toIso(user.lastActive),
    fetchedAt: new Date().toISOString()
  };
}

if (ENABLE_GRAPHQL && profileName) {
  try {
    profile = await fetchProfile(profileName);
    console.log(
      `✓ [v2] ${profile.name}: ${profile.uniqueDownloads} descargas únicas en total, ` +
        `${profile.profileViews} visitas de perfil, ${profile.modCount} mods`
    );
  } catch (error) {
    console.error(`✗ [v2] perfil ${profileName}: ${error.message}`);
    console.log(
      "::warning::No se pudieron leer los totales del perfil desde la GraphQL v2 " +
        "(API en beta). El sitio seguirá mostrando las cifras por mod del v1."
    );
    profile = { ...(profile || { name: profileName }), ok: false, error: String(error.message || error) };
  }
} else if (!ENABLE_GRAPHQL) {
  console.log("· [v2] enriquecido del perfil desactivado (NEXUS_ENABLE_GRAPHQL=false)");
} else {
  console.log("· [v2] manifest.js no define window.NEXUS.profile: se omite el perfil");
}

/* --- 5. Escribir stats.json ---------------------------------------------- */
const previousSynced = previous?.syncedAt ?? null;
const now = new Date().toISOString();

const output = {
  source: {
    mods: "Nexus Mods API v1 (stable) - https://api.nexusmods.com/v1",
    profile: "Nexus Mods GraphQL API v2 (beta) - https://api.nexusmods.com/v2/graphql"
  },
  complete: failed === 0,
  // `syncedAt` solo avanza cuando TODOS los mods se han leído correctamente,
  // así la web nunca presume de una sincronización parcial.
  syncedAt: failed === 0 ? now : previousSynced,
  generatedAt: now,
  mods: modsStats,
  profile
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  `\nstats.json actualizado: ${ok} mod(s) por la v1, ${failed} con error. ` +
    `Perfil v2: ${profile?.ok ? "ok" : "no disponible"}. ` +
    `Sincronización completa: ${output.complete ? "sí" : "no (parcial)"}.`
);

// Un fallo parcial no rompe el workflow (los datos buenos ya están escritos),
// pero se marca en el resumen de GitHub Actions.
if (failed > 0) {
  console.log(`::warning::${failed} mod(s) no se pudieron actualizar desde la API v1 de Nexus.`);
}
