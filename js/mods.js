/* ============================================================================
 * mods.js - tarjetas de mods de Nexus y enlaces externos del perfil
 * ==========================================================================*/
import { createArrowLink, mediaFromEntry, mountImage } from "./utils.js";
import { registerModCard, renderModStats, loadModStats, nexusId } from "./stats.js";

// El usuario de Nexus vive en manifest.js (window.NEXUS.profile).
function applyNexusLinks() {
  const link = document.getElementById("nexus-profile-link");
  const nick = window.NEXUS && window.NEXUS.profile;
  if (link && nick)
    link.href = `https://www.nexusmods.com/profile/${encodeURIComponent(nick)}/mods`;
}

function buildMods(list) {
  const grid = document.getElementById("mods-grid");
  if (!grid) return;
  for (const mod of list) {
    if (mod.hidden === true) continue; // "hidden": true en manifest.js oculta la tarjeta
    const { title = "", description = "", url = "#", game = "" } = mod;
    const repo = mod.repo || "";

    // La tarjeta es un artículo sin click global: las acciones explícitas
    // (enlaces "View on Nexus" / "Source") son las únicas interactivas.
    const card = document.createElement("article");
    card.className = "card";
    registerModCard(card, mod);
    card.dataset.modId = nexusId(url);

    const thumb = mod.thumbnail || "";
    if (thumb) {
      // Miniatura con carga diferida al viewport y variantes AVIF/WebP
      // cuando la imagen es local. watchImage (dentro de mountImage) cubre la
      // cadena de respaldo y los estados visuales del marco. Las imágenes de
      // Nexus tienen proporciones muy distintas entre sí: `thumbAspect` fija
      // el ratio desde el principio y, si no está, se ajusta con las medidas
      // reales en cuanto carga, para que encaje perfecta (sin recortes ni
      // bandas).
      const frame = document.createElement("div");
      frame.className = "media-frame card-media";
      const media = mediaFromEntry({
        file: thumb,
        width: mod.width,
        fileFallback: mod.thumbnailFallback,
        alt: mod.thumbnailAlt || title
      });
      mountImage(frame, media, {
        sizes: "(min-width: 1401px) 1052px, 92vw",
        className: "card-thumb",
        aspect: mod.thumbAspect || null
      });
      frame.addEventListener(
        "load",
        (e) => {
          const img = e.target;
          if (img && img.tagName === "IMG" && img.naturalWidth && img.naturalHeight) {
            img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
          }
        },
        true
      );
      card.appendChild(frame);
    }

    // Cuerpo siempre visible, igual que las cards de Projects.
    const body = document.createElement("div");
    body.className = "card-body";

    const label = document.createElement("p");
    label.className = "card-label";
    label.textContent = game ? `Mod · ${game}` : "Mod";
    body.appendChild(label);

    const h3 = document.createElement("h3");
    h3.className = "card-title";
    h3.textContent = title;
    body.appendChild(h3);

    if (description) {
      const p = document.createElement("p");
      p.className = "card-desc";
      p.textContent = description;
      body.appendChild(p);
    }

    const statsLine = document.createElement("span");
    statsLine.className = "mod-statline";
    body.appendChild(statsLine);

    const actions = document.createElement("div");
    actions.className = "mod-actions";

    const link = createArrowLink({ href: url, label: "View on Nexus " });
    link.addEventListener("click", (e) => e.stopPropagation());
    actions.appendChild(link);

    if (repo) {
      const repoLink = createArrowLink({ href: repo, label: "Source " });
      repoLink.addEventListener("click", (e) => e.stopPropagation());
      actions.appendChild(repoLink);
    }

    body.appendChild(actions);
    card.appendChild(body);
    grid.appendChild(card);
    renderModStats(card);
  }
}

let modsLoaded = false;
export function loadMods() {
  if (modsLoaded) return;
  modsLoaded = true;
  applyNexusLinks();
  buildMods(window.MODS || []);
  void loadModStats();
}
