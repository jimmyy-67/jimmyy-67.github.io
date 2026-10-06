/* ============================================================================
 * lightbox.js - apertura, cierre, navegación y accesibilidad del lightbox
 *
 * Recibe descriptores de medio (js/utils.js) y renderiza imágenes responsivas
 * (<picture> AVIF/WebP con sizes a ancho casi total) o vídeos con su poster
 * y su variante móvil. Mientras se descarga el medio se muestra un spinner.
 * ==========================================================================*/
import { buildPicture, buildVideo, watchImage, watchVideo } from "./utils.js";

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
let lbIndex = -1;
let lightboxTrigger = null;

/* La galería registra aquí su lista de descriptores (ruta, variantes y
   metadatos) para poder navegar con flechas y anunciar título/posición. */
export function setLightboxItems(list) {
  items = Array.isArray(list) ? list : [];
}

export function openLightbox(media) {
  if (!lightbox) return;
  if (!lightbox.open) {
    lightboxTrigger = document.activeElement;
  }
  lbIndex = items.indexOf(media);
  if (lbIndex === -1) lbIndex = 0;
  renderLightbox(media);
}

/* El lightbox pide la máxima calidad disponible: `sizes` a ancho casi total
   de ventana, sobre el mismo srcset de variantes. */
function renderLightbox(media) {
  lightboxMedia.replaceChildren();

  const position = items.length ? `Image ${lbIndex + 1} of ${items.length}` : "";
  lightbox.setAttribute(
    "aria-label",
    [media.title || "Media preview", media.description || "", position].filter(Boolean).join(". ")
  );

  /* watchImage/watchVideo pintan el spinner (media-pending) mientras llega
     el medio, lo retiran al cargar y dejan un aviso si falla. */
  if (media.video) {
    const video = buildVideo(media, {
      className: "lb-video",
      controls: true,
      autoplay: true,
      preload: "auto"
    });
    if (media.poster) video.poster = media.poster;
    watchVideo(video, { container: lightboxMedia });
    lightboxMedia.appendChild(video);
  } else {
    const { picture, img } = buildPicture(media, { sizes: "94vw", className: "lb-image" });
    watchImage(img, { container: lightboxMedia, fallback: media.fallback || "" });
    lightboxMedia.appendChild(picture);
  }

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
