/* ============================================================================
 * gallery.js - renderizado de las galerías del portfolio y pestañas
 * ==========================================================================*/
import { VIDEO_RE, imgObserver, videoObserver, resolveMediaSrc } from "./utils.js";
import { openLightbox, setLightboxItems } from "./lightbox.js";

/* build gallery cards */
function buildGallery() {
  const gallery = window.GALLERY || {};
  const galleryFlat = [];
  for (const [category, items] of Object.entries(gallery)) {
    const grid = document.getElementById(`grid-${category}`);
    if (!grid) continue;
    for (const item of items) {
      const finalSrc = resolveMediaSrc(item.file);
      galleryFlat.push(finalSrc);
      const card = document.createElement("div");
      card.className = "card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", item.title || "Open media");
      card.addEventListener("click", () => openLightbox(finalSrc));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(finalSrc);
        }
      });

      if (VIDEO_RE.test(finalSrc)) {
        const video = document.createElement("video");
        video.className = "card-thumb";
        video.src = finalSrc;
        video.preload = "metadata";
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        videoObserver.observe(video);
        // hover play
        card.addEventListener("mouseenter", () => {
          video.play().catch(() => {});
        });
        card.addEventListener("mouseleave", () => {
          video.pause();
        });
        card.addEventListener("focusin", () => {
          video.play().catch(() => {});
        });
        card.addEventListener("focusout", () => {
          video.pause();
        });
        card.appendChild(video);
        const badge = document.createElement("span");
        badge.className = "thumb-badge";
        badge.textContent = "Clip";
        card.appendChild(badge);
      } else {
        const img = document.createElement("img");
        img.className = "card-thumb";
        img.dataset.src = finalSrc;
        img.alt = item.title || "";
        img.loading = "lazy";
        img.decoding = "async";
        imgObserver.observe(img);
        card.appendChild(img);
      }

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
      grid.appendChild(card);
    }
    const countEl = document.querySelector(`.gallery-tab[data-tab="${category}"] .tab-count`);
    if (countEl) countEl.textContent = String(items.length);
  }
  return galleryFlat;
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
  setLightboxItems(buildGallery());
  initGalleryTabs();
}
