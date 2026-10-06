/* ============================================================================
 * stats.js - estadísticas en vivo de Nexus Mods y respaldos estáticos
 *
 * Datos en vivo de stats.json (los rellena la API de Nexus vía GitHub
 * Actions). stats.json manda; manifest.js solo actúa de respaldo si aún no
 * hay datos.
 * ==========================================================================*/

let liveStats = null;

/* El mod de cada tarjeta se guarda en un WeakMap en lugar de en una
   propiedad personalizada del elemento (antes card._mod): el DOM queda
   limpio y la entrada se libera sola cuando la tarjeta desaparece. */
const modByCard = new WeakMap();

export function registerModCard(card, mod) {
  modByCard.set(card, mod);
}

export function nexusId(url) {
  const m = /nexusmods\.com\/[^/]+\/mods\/(\d+)/.exec(url || "");
  return m ? m[1] : "";
}

function statPill(text, opts) {
  const { title = "" } = opts || {};
  const span = document.createElement("span");
  span.className = "mod-stat";
  span.textContent = text;
  if (title) span.title = title;
  return span;
}

// stats.json manda; manifest.js solo actúa de respaldo si aún no hay datos.
function statsFor(mod) {
  const live = (liveStats && liveStats.mods && liveStats.mods[nexusId(mod.url)]) || null;
  const backup = mod.stats || {};
  return {
    uniqueDownloads: live?.uniqueDownloads ?? backup.uniqueDownloads ?? null,
    totalDownloads: live?.totalDownloads ?? null
  };
}

export function renderModStats(card) {
  const line = card.querySelector(".mod-statline");
  if (!line) return;
  const s = statsFor(modByCard.get(card) || {});
  if (s.uniqueDownloads === null || s.uniqueDownloads === undefined) {
    line.hidden = true;
    return;
  }
  line.hidden = false;
  line.textContent = `${s.uniqueDownloads.toLocaleString()} unique downloads`;
  line.title =
    s.totalDownloads !== null
      ? `Total downloads on Nexus: ${s.totalDownloads.toLocaleString()}`
      : "";
}

// Totales del perfil (GraphQL v2): solo el acumulado de descargas únicas.
function renderModsProfile() {
  const box = document.getElementById("mods-profile");
  if (!box) return;
  const p = (liveStats && liveStats.profile) || null;
  box.textContent = "";
  if (!p) {
    box.hidden = true;
    return;
  }
  const total = Number(p.uniqueDownloads);
  if (Number.isFinite(total)) {
    box.appendChild(
      statPill(`${total.toLocaleString()} unique downloads from my mods`, {
        title: "Unique downloads across every mod on this profile (Nexus Mods GraphQL v2)"
      })
    );
  }
  box.hidden = box.childElementCount === 0;
}

// Tiles de stats de About: el acumulado vive en stats.json (Nexus en vivo);
// sin red queda el respaldo estático de manifest.js. El conteo de mods sale
// del propio manifest (excluye tarjetas ocultas).
export function renderAboutStats() {
  const dl = document.getElementById("about-dl");
  const p = (liveStats && liveStats.profile) || null;
  const total = p ? Number(p.uniqueDownloads) : NaN;
  if (dl && Number.isFinite(total)) dl.textContent = total.toLocaleString();
  const mods = document.getElementById("about-mods");
  if (mods) mods.textContent = String((window.MODS || []).filter((m) => m.hidden !== true).length);
}

// Cifras reales de la API de Nexus (se regeneran a diario en GitHub Actions).
// Si el archivo no existe todavía, se mantienen los valores de manifest.js.
async function fetchModStats() {
  try {
    const res = await fetch(`stats.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || typeof data !== "object" || !data.mods) return;
    liveStats = data;
    document.querySelectorAll("#mods-grid .card").forEach(renderModStats);
    renderModsProfile();
    renderAboutStats();
  } catch {
    /* sin red o sin stats.json: seguimos con los valores de respaldo */
  }
}

/* Descarga stats.json una sola vez por página, esté donde esté el usuario
   cuando lo pida (About pinta las cifras al llegar, los mods al listar).
   La promesa se comparte: si dos vistas la piden a la vez, solo hay un
   fetch. */
let statsPromise = null;
export function ensureStats() {
  statsPromise ??= fetchModStats();
  return statsPromise;
}
