/* ============================================================================
 * utils.js - helpers compartidos entre módulos
 *
 * Observadores perezosos (imágenes y vídeos), creación de enlaces con flecha,
 * resolución de rutas de la galería y fallback de imágenes vía data-fallback.
 * ==========================================================================*/

export const VIDEO_RE = /\.(mp4|mov)$/i;

/* Fallback para navegadores sin IntersectionObserver: ejecuta el callback
   inmediatamente como si cada elemento observado fuera visible. Las imágenes
   se cargan al construirse (sin lazy-load) y los vídeos nunca se pausan por
   scroll; el sitio sigue funcionando igual, solo pierde la optimización. */
class ImmediateObserver {
  constructor(callback) {
    this._callback = callback;
  }
  observe(el) {
    this._callback([{ target: el, isIntersecting: true, intersectionRatio: 1 }], this);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const ObserverImpl =
  typeof window !== "undefined" && "IntersectionObserver" in window
    ? window.IntersectionObserver
    : ImmediateObserver;

/* lazy-load de imágenes: la src real vive en data-src hasta ser visible */
export const imgObserver = new ObserverImpl(
  (entries, observer) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target;
      if (el.dataset.src) el.src = el.dataset.src;
      el.removeAttribute("data-src");
      observer.unobserve(el);
    }
  },
  { rootMargin: "300px" }
);

/* video observer: los clips solo se reproducen al pasar el ratón o al
   recibir el foco; en cuanto salen de pantalla se pausan para no gastar
   CPU ni ancho de banda en algo que nadie está viendo. */
export const videoObserver = new ObserverImpl(
  (entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) en.target.pause();
    }
  },
  { rootMargin: "200px", threshold: 0.25 }
);

/* Convierte la ruta corta del manifest en la ruta final servible:
   lo que no empiece por videos/, img/, / o http vive en img/portfolio/. */
export function resolveMediaSrc(raw) {
  if (typeof raw !== "string" || raw === "") return "";
  return raw.startsWith("videos/") ||
    raw.startsWith("img/") ||
    raw.startsWith("/") ||
    raw.startsWith("http")
    ? raw
    : `img/portfolio/${raw}`;
}

/* Enlace externo con flecha decorativa, construido sin innerHTML:
   texto con textContent/createTextNode y flecha como <span> real. */
export function createArrowLink({ className = "card-link", href = "#", label = "" } = {}) {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener";
  link.append(document.createTextNode(label));
  const arrow = document.createElement("span");
  arrow.className = "arrow";
  arrow.textContent = "↗";
  link.appendChild(arrow);
  return link;
}

/* ===== Fallback de imágenes =====
   Sustituye al atributo inline `onerror`: si una imagen falla, se usa la
   ruta indicada en `data-fallback`. El listener de captura atiende errores
   a partir de ahora y el barrido final cubre los que ocurrieron antes de
   que este script cargara (p. ej. el logo, que está arriba del todo). */
export function initImageFallback() {
  const imgFallback = (el) => {
    const fb = el.dataset.fallback;
    if (fb && !el.src.endsWith(fb)) el.src = fb;
  };
  document.addEventListener(
    "error",
    (e) => {
      if (e.target instanceof HTMLImageElement) imgFallback(e.target);
    },
    true
  );
  document.querySelectorAll("img[data-fallback]").forEach((el) => {
    if (el.complete && el.naturalWidth === 0) imgFallback(el);
  });
}
