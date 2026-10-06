/* ============================================================================
 * mods.js - tarjetas de mods de Nexus y enlaces externos del perfil
 * ==========================================================================*/
import { createArrowLink, imgObserver, watchImage } from "./utils.js";
import { loadModStats, nexusId, registerModCard, renderModStats } from "./stats.js";

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
    const fallback = mod.thumbnailFallback || "";
    if (thumb) {
      const frame = document.createElement("div");
      frame.className = "media-frame";
      const img = document.createElement("img");
      img.className = "card-thumb";
      img.dataset.src = thumb;
      img.alt = mod.thumbnailAlt || title;
      img.loading = "lazy";
      img.decoding = "async";

      // Las imágenes de Nexus tienen proporciones muy distintas entre sí:
      // el marco adopta la proporción real de la imagen en cuanto se conoce,
      // para que encaje perfecta (sin recortes ni bandas). `thumbAspect` en
      // manifest.js permite fijarla desde el principio y evitar el salto.
      if (mod.thumbAspect) img.style.aspectRatio = mod.thumbAspect;
      const fitRatio = () => {
        if (img.naturalWidth && img.naturalHeight) {
          img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        }
      };
      if (img.complete && img.naturalWidth) fitRatio();
      else img.addEventListener("load", fitRatio);

      watchImage(img, { container: frame, fallback });
      imgObserver.observe(img);
      frame.appendChild(img);
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
    link.addEventListener("click", (event) => event.stopPropagation());
    actions.appendChild(link);

    if (repo) {
      const repoLink = createArrowLink({ href: repo, label: "Source " });
      repoLink.addEventListener("click", (event) => event.stopPropagation());
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
