/* ============================================================================
 * gallery.js - renderizado de las galerías del portfolio y pestañas
 *
 * Carga diferida en dos niveles: los descriptores de TODA la galería se
 * calculan al arrancar (datos puros, sin DOM ni red) para que el lightbox
 * pueda navegar por las tres pestañas, pero cada rejilla solo se construye
 * la primera vez que se activa su pestaña. Dentro de la rejilla, cada medio
 * se construye al entrar en el viewport.
 * ==========================================================================*/
import { mediaFromEntry, mountImage, buildVideo, attachPoster, watchVideo } from "./utils.js";
import { openLightbox, setLightboxItems } from "./lightbox.js";
import { siteLabel } from "./site.js";

/* Ancho aproximado de cada tarjeta según su rejilla; alimenta `sizes`. */
const GRID_SIZES = {
  unity: "(min-width: 701px) 588px, 92vw",
  godot: "(min-width: 701px) 360px, 92vw",
  environments: "(min-width: 701px) 360px, 92vw"
};

/* Descriptor + categoría de cada elemento, en orden de lightbox. */
const galleryItems = [];
const builtGrids = new Set();

function buildGalleryCard(category, item) {
  const media = mediaFromEntry(item);

  const card = document.createElement("div");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", item.title || siteLabel("gallery.openMedia", "Open media"));
  card.addEventListener("click", () => openLightbox(media));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openLightbox(media);
    }
  });

  /* Marco con esqueleto: reserva el hueco y muestra el shimmer hasta que
     el medio está listo (o el poster del vídeo lo cubre). */
  const frame = document.createElement("div");
  frame.className = "media-frame";

  if (media.video) {
    /* preload=metadata: basta para que watchVideo retire el spinner al
       confirmar que el clip responde, sin descargar el vídeo entero. */
    const video = buildVideo(media, { className: "card-thumb", preload: "metadata" });
    frame.appendChild(video);
    watchVideo(video, { container: frame });
    attachPoster(frame, media, video);
    // hover play
    card.addEventListener("mouseenter", () => {
      video.play()?.catch(() => {});
    });
    card.addEventListener("mouseleave", () => {
      video.pause();
    });
    card.addEventListener("focusin", () => {
      video.play()?.catch(() => {});
    });
    card.addEventListener("focusout", () => {
      video.pause();
    });
    const badge = document.createElement("span");
    badge.className = "thumb-badge";
    badge.textContent = siteLabel("gallery.clip", "Clip");
    frame.appendChild(badge);
  } else {
    mountImage(frame, media, {
      sizes: GRID_SIZES[category] || "(min-width: 701px) 600px, 92vw",
      className: "card-thumb"
    });
  }
  card.appendChild(frame);

  const body = document.createElement("div");
  body.className = "card-body";
  if (item.title) {
    const h3 = document.createElement("h3");
    h3.className = "card-title";
    h3.textContent = item.title;
    body.appendChild(h3);
  }
  if (item.description) {
    const p = document.createElement("p");
    p.className = "card-desc";
    p.textContent = item.description;
    body.appendChild(p);
  }

  card.appendChild(body);
  return card;
}

/* Cada pestaña se construye la primera vez que se activa: abrir la galería
   no descarga nada de las pestañas Godot o Environments. */
export function ensureGalleryGrid(category) {
  if (!category || builtGrids.has(category)) return;
  const grid = document.getElementById(`grid-${category}`);
  if (!grid) return;
  builtGrids.add(category);
  const items = (window.GALLERY || {})[category] || [];
  for (const item of items) grid.appendChild(buildGalleryCard(category, item));
}

/* gallery tabs: estado visual, ARIA y foco se actualizan juntos */
function initGalleryTabs() {
  const galleryTablist = document.querySelector(".gallery-tabs[role='tablist']");
  if (!galleryTablist) return;
  const galleryTabs = Array.from(galleryTablist.querySelectorAll("[role='tab']"));
  if (galleryTabs.length === 0) return;

  function selectGalleryTab(selectedTab, { moveFocus = false } = {}) {
    galleryTabs.forEach((tab) => {
      const selected = tab === selectedTab;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;

      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !selected;
    });

    ensureGalleryGrid(selectedTab?.dataset.tab);
    if (moveFocus) selectedTab.focus();
  }

  galleryTabs.forEach((tab) => {
    tab.addEventListener("click", () => selectGalleryTab(tab));
  });

  // Patrón de teclado ARIA: flechas recorren las pestañas; Inicio y Fin
  // saltan a los extremos. La activación es automática al mover el foco.
  galleryTablist.addEventListener("keydown", (event) => {
    const current = galleryTabs.indexOf(document.activeElement);
    if (current === -1) return;

    let next;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (current + 1) % galleryTabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (current - 1 + galleryTabs.length) % galleryTabs.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = galleryTabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    selectGalleryTab(galleryTabs[next], { moveFocus: true });
  });
}

export function initGallery() {
  /* Descriptores y contadores: datos puros, sin construir ninguna rejilla. */
  for (const [category, items] of Object.entries(window.GALLERY || {})) {
    for (const item of items) galleryItems.push(mediaFromEntry(item));
    const countEl = document.querySelector(`.gallery-tab[data-tab="${category}"] .tab-count`);
    if (countEl) countEl.textContent = String(items.length);
  }
  setLightboxItems(galleryItems);
  initGalleryTabs();
}

/* La vista Portfolio construye solo la pestaña activa (la llama el router
   la primera vez que se navega a la sección). */
export function initPortfolioView() {
  const active = document.querySelector(".gallery-tab.active");
  ensureGalleryGrid(active?.dataset.tab || "unity");
}
