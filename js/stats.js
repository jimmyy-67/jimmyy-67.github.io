/* ============================================================================
 * stats.js - estadísticas en vivo de Nexus Mods y respaldos estáticos
 *
 * Datos en vivo de stats.json (los rellena la API de Nexus vía GitHub
 * Actions). stats.json manda; manifest.js solo actúa de respaldo si aún no
 * hay datos o si el archivo no se puede consultar.
 * ==========================================================================*/

let liveStats = null;
let statsRequest = null;
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

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

function updateStatsStatus({ state, message, updatedAt = null }) {
  const date = updatedAt ? new Date(updatedAt) : null;
  const hasValidDate = date && Number.isFinite(date.getTime());
  document.querySelectorAll("[data-stats-status]").forEach((status) => {
    const text = status.querySelector("[data-stats-status-text]");
    const timestamp = status.querySelector("[data-stats-updated]");
    const spinner = status.querySelector(".stats-spinner");
    if (!text || !timestamp) return;

    status.dataset.state = state;
    status.hidden = false;
    text.textContent = message;
    if (spinner) spinner.hidden = state !== "loading";

    if (hasValidDate) {
      timestamp.dateTime = date.toISOString();
      timestamp.textContent = date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      });
      timestamp.hidden = false;
    } else {
      timestamp.removeAttribute("datetime");
      timestamp.textContent = "";
      timestamp.hidden = true;
    }
  });
}

function showStatsFreshness(data) {
  const updatedAt = data.syncedAt || data.generatedAt || null;
  const date = updatedAt ? new Date(updatedAt) : null;
  if (!date || !Number.isFinite(date.getTime())) {
    updateStatsStatus({
      state: "stale",
      message: "Statistics were loaded, but their update date is unavailable."
    });
    return;
  }

  const age = Date.now() - date.getTime();
  if (age > STALE_AFTER_MS) {
    updateStatsStatus({
      state: "stale",
      message: "Statistics may be out of date. Last updated:",
      updatedAt
    });
    return;
  }
  updateStatsStatus({ state: "ready", message: "Last updated:", updatedAt });
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
// Si el archivo no existe, es inválido o no hay red, se mantienen los valores
// estáticos de manifest.js y se informa del problema de forma visible.
export function loadModStats() {
  if (liveStats) return Promise.resolve(liveStats);
  if (statsRequest) return statsRequest;

  updateStatsStatus({ state: "loading", message: "Refreshing Nexus Mods statistics…" });
  statsRequest = (async () => {
    try {
      const res = await fetch(`stats.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`stats.json responded with HTTP ${res.status}`);
      const data = await res.json();
      if (!data || typeof data !== "object" || !data.mods || typeof data.mods !== "object") {
        throw new Error("stats.json has an invalid format");
      }
      liveStats = data;
      document.querySelectorAll("#mods-grid .card").forEach(renderModStats);
      renderModsProfile();
      renderAboutStats();
      showStatsFreshness(data);
      return liveStats;
    } catch {
      updateStatsStatus({
        state: "error",
        message: "Statistics could not be refreshed. Showing saved fallback figures."
      });
      return null;
    } finally {
      statsRequest = null;
    }
  })();
  return statsRequest;
}
