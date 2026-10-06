/* ============================================================================
 * lightbox.js - apertura, cierre, navegación y accesibilidad del lightbox
 * ==========================================================================*/
import { VIDEO_RE } from "./utils.js";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "video[controls]"
].join(",");

let lightbox = null;
let lightboxMedia = null;
let lightboxClose = null;
let items = [];
let itemsMeta = [];
let lbIndex = -1;
let lightboxTrigger = null;

/* La galería registra aquí su lista plana (rutas) y los metadatos de cada
   elemento para poder navegar con flechas y anunciar título/posición. */
export function setLightboxItems(list, meta) {
  items = Array.isArray(list) ? list : [];
  itemsMeta = Array.isArray(meta) ? meta : [];
}

export function openLightbox(src) {
  if (!lightbox) return;
  if (!lightbox.open) {
    lightboxTrigger = document.activeElement;
  }
  lbIndex = items.indexOf(src);
  if (lbIndex === -1) lbIndex = 0;
  renderLightbox(src);
}

function renderLightbox(src) {
  lightboxMedia.replaceChildren();
  const item = itemsMeta[lbIndex] || {};
  const position = items.length ? `Imagen ${lbIndex + 1} de ${items.length}` : "";
  lightbox.setAttribute(
    "aria-label",
    [item.title || "Vista previa multimedia", item.description || "", position]
      .filter(Boolean)
      .join(". ")
  );

  let el;
  if (VIDEO_RE.test(src)) {
    el = document.createElement("video");
    el.src = src;
    el.muted = true;
    el.loop = true;
    el.autoplay = true;
    el.controls = true;
    el.playsInline = true;
  } else {
    el = document.createElement("img");
    el.src = src;
    el.alt = "";
  }

  lightboxMedia.appendChild(el);
  if (!lightbox.open && typeof lightbox.showModal === "function") lightbox.showModal();
  lightbox.classList.add("open");
  lightboxClose.focus();
}

function closeLightbox() {
  if (!lightbox.open) return;

  lightbox.classList.remove("open");
  lightboxMedia.replaceChildren();
  lightbox.close();

  const trigger = lightboxTrigger;
  lightboxTrigger = null;
  if (trigger && trigger.isConnected && typeof trigger.focus === "function") {
    trigger.focus();
  }
}

function navLightbox(dir) {
  if (!lightbox.open || items.length === 0) return;
  lbIndex = (lbIndex + dir + items.length) % items.length;
  renderLightbox(items[lbIndex]);
}

function trapLightboxFocus(event) {
  const focusable = [...lightbox.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (el) => el.getAttribute("aria-hidden") !== "true"
  );

  if (focusable.length === 0) {
    event.preventDefault();
    lightbox.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (
    event.shiftKey &&
    (document.activeElement === first || !lightbox.contains(document.activeElement))
  ) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || !lightbox.contains(document.activeElement))
  ) {
    event.preventDefault();
    first.focus();
  }
}

export function initLightbox() {
  lightbox = document.getElementById("lightbox");
  if (!lightbox) return;
  lightboxMedia = lightbox.querySelector(".lightbox-media");
  lightboxClose = lightbox.querySelector(".lightbox-close");
  if (!lightboxMedia || !lightboxClose) {
    lightbox = null;
    return;
  }

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  addEventListener("keydown", (event) => {
    if (!lightbox.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
    } else if (event.key === "Tab") {
      trapLightboxFocus(event);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      navLightbox(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      navLightbox(-1);
    }
  });
}
