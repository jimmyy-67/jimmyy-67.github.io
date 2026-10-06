/* ============================================================================
 * utils.js - helpers compartidos entre módulos
 *
 * Observadores perezosos (imágenes y vídeos), creación de enlaces con flecha,
 * resolución de rutas, estados visuales de media y degradación de servicios
 * externos.
 * ==========================================================================*/

export const VIDEO_RE = /\.(mp4|mov)$/i;
export const MEDIA_PLACEHOLDER = "img/media-placeholder.svg";

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

/* ===== Estado visual de recursos multimedia ===== */
export function setMediaState(container, state, message = "") {
  if (!container) return;
  container.classList.remove("media-pending", "media-loaded", "media-error");
  container.removeAttribute("data-media-error");
  if (state === "loading") container.classList.add("media-pending");
  if (state === "loaded") container.classList.add("media-loaded");
  if (state === "error") {
    container.classList.add("media-error");
    container.dataset.mediaError = message || "Media could not be loaded.";
  }
}

function useNextImageFallback(img) {
  const fallback = img.dataset.fallback;
  if (fallback && img.dataset.fallbackUsed !== "true") {
    img.dataset.fallbackUsed = "true";
    img.dataset.fallbackTransition = "true";
    img.src = fallback;
    queueMicrotask(() => delete img.dataset.fallbackTransition);
    return true;
  }

  const placeholder = img.dataset.placeholder || (img.dataset.fallback ? MEDIA_PLACEHOLDER : "");
  if (placeholder && img.dataset.placeholderUsed !== "true") {
    img.dataset.placeholderUsed = "true";
    img.dataset.fallbackTransition = "true";
    img.src = placeholder;
    queueMicrotask(() => delete img.dataset.fallbackTransition);
    return true;
  }
  return false;
}

/* Registra tanto la reserva de espacio como los estados de carga/error de una
   imagen. El placeholder local es el último recurso: no depende de Nexus ni
   itch.io, así que también funciona durante una caída de esos CDNs. */
export function watchImage(img, { container = img.parentElement, fallback = "" } = {}) {
  if (fallback) img.dataset.fallback = fallback;
  if (!img.dataset.placeholder) img.dataset.placeholder = MEDIA_PLACEHOLDER;
  setMediaState(container, "loading");

  img.addEventListener("load", () => setMediaState(container, "loaded"));
  img.addEventListener("error", () => {
    // initImageFallback (listener de captura) ya habrá intentado sustituir la
    // URL. Esta marca evita saltar directamente al placeholder en el mismo
    // evento antes de que el fallback personalizado tenga oportunidad de cargar.
    if (img.dataset.fallbackTransition === "true") return;
    if (!useNextImageFallback(img)) {
      setMediaState(container, "error", "This image could not be loaded.");
    }
  });

  // Cubre imágenes de caché que terminaron antes de registrar los listeners,
  // pero no las lazy que todavía solo tienen data-src.
  if (img.getAttribute("src") && img.complete) {
    if (img.naturalWidth) setMediaState(container, "loaded");
    else if (!useNextImageFallback(img)) {
      setMediaState(container, "error", "This image could not be loaded.");
    }
  }
}

/* Los vídeos no tienen un sustituto visual equivalente; el estado de error
   deja un mensaje legible sobre la tarjeta en lugar de un rectángulo vacío. */
export function watchVideo(video, { container = video.parentElement } = {}) {
  setMediaState(container, "loading");
  // Con preload="metadata" algunos navegadores no descargan el primer frame
  // hasta que se reproduce; los metadatos ya confirman que el recurso llegó y
  // evitan dejar un spinner permanente en una miniatura válida.
  const markLoaded = () => setMediaState(container, "loaded");
  video.addEventListener("loadedmetadata", markLoaded, { once: true });
  video.addEventListener("loadeddata", markLoaded, { once: true });
  video.addEventListener(
    "error",
    () => setMediaState(container, "error", "This video could not be loaded."),
    { once: true }
  );
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) setMediaState(container, "loaded");
}

/**
 * Aplica en un único lugar las garantías de aislamiento y privacidad de
 * todos los enlaces que abren una pestaña nueva.
 */
export function secureExternalLink(link, url = link.href) {
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  markExternalServiceLink(link, url);
  return link;
}

function externalServiceFor(url) {
  try {
    const hostname = new URL(url, document.baseURI).hostname.toLowerCase();
    if (
      hostname === "discord.gg" ||
      hostname.endsWith(".discord.com") ||
      hostname === "discord.com"
    ) {
      return { key: "discord", label: "Discord" };
    }
    if (hostname === "fandom.com" || hostname.endsWith(".fandom.com")) {
      return { key: "fandom", label: "Fandom" };
    }
  } catch {
    /* A URL inválida se tratará como enlace normal y la validación de CI la detectará. */
  }
  return null;
}

function markExternalServiceLink(link, url) {
  const service = externalServiceFor(url);
  if (!service) return;
  link.dataset.externalService = service.key;
  link.dataset.externalServiceLabel = service.label;
}

/* También protege enlaces declarativos presentes en index.html y evita que
   una futura omisión de `rel` llegue al navegador. */
export function hardenExternalLinks() {
  document.querySelectorAll('a[target="_blank"]').forEach((link) => secureExternalLink(link));
}

/* Enlace externo con flecha decorativa, construido sin innerHTML:
   texto con textContent/createTextNode y flecha como <span> real. */
export function createArrowLink({ className = "card-link", href = "#", label = "" } = {}) {
  const link = secureExternalLink(document.createElement("a"), href);
  link.className = className;
  link.append(document.createTextNode(label));
  const arrow = document.createElement("span");
  arrow.className = "arrow";
  arrow.textContent = "↗";
  link.appendChild(arrow);
  return link;
}

/* ===== Fallback de imágenes =====
   Sustituye al atributo inline `onerror`: primero prueba data-fallback y, si
   también falla, el placeholder local. El listener de captura atiende errores
   a partir de ahora y el barrido final cubre los que ocurrieron antes de que
   este script cargara (p. ej. el logo, que está arriba del todo). */
export function initImageFallback() {
  const replaceFailedImage = (el) => {
    if (!(el instanceof HTMLImageElement)) return false;
    return useNextImageFallback(el);
  };
  document.addEventListener(
    "error",
    (event) => {
      replaceFailedImage(event.target);
    },
    true
  );
  document.querySelectorAll("img[data-fallback], img[data-placeholder]").forEach((el) => {
    if (el.complete && el.naturalWidth === 0) replaceFailedImage(el);
  });
}

/* ===== Degradación de destinos Discord / Fandom =====
   GitHub Pages no puede consultar el estado HTTP de otro origen desde el
   navegador (CORS oculta ese detalle). Aun así, una petición no-cors permite
   detectar ausencia de red, errores de transporte y timeout. Los códigos HTTP
   se verifican de forma completa en site-integrity.yml al publicar y cada
   semana. El enlace conserva su apertura normal en otra pestaña. */
const DESTINATION_TIMEOUT_MS = 8_000;

function updateExternalServiceStatus(status, message = "", state = "") {
  if (!status) return;
  status.hidden = !message;
  if (state) status.dataset.state = state;
  else status.removeAttribute("data-state");
  status.textContent = message;
}

async function probeExternalDestination(link, status) {
  const label = link.dataset.externalServiceLabel || "This service";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DESTINATION_TIMEOUT_MS);
  try {
    await fetch(link.href, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal
    });
    updateExternalServiceStatus(status);
  } catch {
    updateExternalServiceStatus(
      status,
      `${label} is not responding right now. Please try again in a moment or use the other contact links.`,
      "error"
    );
  } finally {
    clearTimeout(timer);
  }
}

export function initExternalServiceFeedback() {
  const status = document.getElementById("external-service-status");
  if (!status) return;

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a[data-external-service]");
    if (!link || event.defaultPrevented) return;
    const label = link.dataset.externalServiceLabel || "This service";

    if (navigator.onLine === false) {
      event.preventDefault();
      updateExternalServiceStatus(
        status,
        `You appear to be offline, so ${label} cannot be opened right now. Please reconnect and try again.`,
        "error"
      );
      return;
    }
    void probeExternalDestination(link, status);
  });

  addEventListener("offline", () => {
    updateExternalServiceStatus(
      status,
      "You are offline. Discord and Fandom links will be available again after reconnecting.",
      "error"
    );
  });
}
