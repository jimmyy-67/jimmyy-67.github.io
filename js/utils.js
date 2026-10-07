/* ============================================================================
 * utils.js - helpers compartidos entre módulos
 *
 * Observadores perezosos, creación de enlaces con flecha, resolución de
 * rutas, construcción de medios responsivos (<picture> AVIF/WebP, <video>
 * con variante móvil + poster) bajo carga diferida, estados visuales de
 * media con cadena de respaldo (fallback -> placeholder) y degradación de
 * servicios externos.
 * ==========================================================================*/

export const VIDEO_RE = /\.(mp4|mov)(?:\?|$)/i;
const IMAGE_RE = /\.(avif|webp|png|jpe?g)(?:\?|$)/i;
export const MEDIA_PLACEHOLDER = "img/media-placeholder.svg";

/* Breakpoint móvil del sitio (el mismo del menú hamburguesa en styles.css). */
const MOBILE_MEDIA = "(max-width: 700px)";

/* Anchuras de las variantes responsive que genera `npm run optimize:media`
   y verifica `npm run check:media` en CI (ver README). */
const VARIANT_WIDTHS = [640, 1024];

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

/* Carga diferida de medios: cuando el marco entra en el viewport (con un
   margen de 300px) se construye la imagen o se asigna el poster del vídeo.
   Hasta entonces no se descarga absolutamente nada. */
const lazyObserver = new ObserverImpl(
  (entries, observer) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target;
      observer.unobserve(el);
      if (typeof el.lazyFill === "function") el.lazyFill();
    }
  },
  { rootMargin: "300px" }
);

export function lazyFill(el, fill) {
  el.lazyFill = fill;
  lazyObserver.observe(el);
}

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

/* ---------- medios responsivos ---------- */
const isRemote = (url) => /^(?:https?:)?\/\//i.test(url);
const stripQuery = (url) => {
  const query = url.indexOf("?");
  return query === -1 ? url : url.slice(0, query);
};
const withoutExtension = (url) => stripQuery(url).replace(/\.[^./]+$/, "");
const basename = (url) => stripQuery(url).split("/").pop() || url;

/* `videos/foo.mp4` -> `videos/foo-mobile.mp4` (convención de optimize:media). */
function mobileVideoFor(src) {
  return `${withoutExtension(src)}-mobile.mp4`;
}

/* `videos/foo.mp4` -> `img/posters/foo.webp` (convención de optimize:media). */
function posterFor(src) {
  return `img/posters/${basename(src).replace(/\.[^.]+$/, "")}.webp`;
}

/* Descriptor de medio a partir de una entrada del manifest (galería, works o
   mods): reúne la ruta final, sus variantes y los metadatos que necesitan
   tarjetas y lightbox. En remoto (p. ej. un CDN) no se presuponen variantes
   locales; solo se usan las que declare el propio manifest. */
export function mediaFromEntry(item) {
  const raw = item.file || item.thumbnail || "";
  const src = resolveMediaSrc(raw);
  const video = VIDEO_RE.test(src);
  return {
    src,
    video,
    width: item.width || null,
    fallback: item.fileFallback || item.thumbnailFallback || null,
    alt: item.alt || item.thumbnailAlt || item.title || "",
    description: item.description || "",
    mobile: video ? item.mobile || (isRemote(src) ? null : mobileVideoFor(src)) : null,
    poster: video ? item.poster || (isRemote(src) ? null : posterFor(src)) : null,
    title: item.title || ""
  };
}

/* srcset con las variantes 640/1024 y el archivo completo como candidato
   mayor. La existencia de todas las rutas la garantiza check-media en CI. */
function srcsetFor(base, format, fullWidth) {
  const stem = withoutExtension(base);
  const candidates = VARIANT_WIDTHS.filter((width) => width < fullWidth).map(
    (width) => `${stem}-${width}.${format} ${width}w`
  );
  candidates.push(`${stem}.${format} ${fullWidth}w`);
  return candidates.join(", ");
}

/* <picture> con AVIF -> WebP; el <img> interior conserva el fallback a PNG
   vía data-fallback (lo gestiona watchImage/initImageFallback). */
export function buildPicture(media, { sizes, className }) {
  const picture = document.createElement("picture");
  if (!isRemote(media.src) && media.width && IMAGE_RE.test(media.src)) {
    for (const [format, type] of [
      ["avif", "image/avif"],
      ["webp", "image/webp"]
    ]) {
      const source = document.createElement("source");
      source.type = type;
      source.srcset = srcsetFor(media.src, format, media.width);
      source.sizes = sizes;
      picture.appendChild(source);
    }
  }
  const img = document.createElement("img");
  img.className = className;
  img.alt = media.alt || "";
  img.decoding = "async";
  /* La construcción ya se difiere al viewport; loading=lazy es el cinturón
     de seguridad extra del propio navegador. */
  img.loading = "lazy";
  img.src = media.src;
  if (media.fallback) img.dataset.fallback = media.fallback;
  picture.appendChild(img);
  return { picture, img };
}

/* <video> con fuentes selectivas: la variante móvil va primero y solo se
   usa en pantallas pequeñas (o con Save-Data activo, en cualquier pantalla);
   la completa es el respaldo por defecto. Con `preload="none"` no se
   descarga nada hasta que el usuario pide reproducir. */
export function buildVideo(
  media,
  { className, controls = false, autoplay = false, preload = "none" } = {}
) {
  const video = document.createElement("video");
  video.className = className;
  video.preload = preload;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  if (controls) video.controls = true;
  if (autoplay) video.autoplay = true;

  const saveData =
    typeof navigator === "object" && navigator.connection && navigator.connection.saveData === true;

  const appendSource = (src, { media: mediaQuery = null } = {}) => {
    const source = document.createElement("source");
    source.src = src;
    source.type = "video/mp4";
    if (mediaQuery) source.media = mediaQuery;
    video.appendChild(source);
  };

  if (media.mobile && saveData) {
    appendSource(media.mobile);
  } else {
    if (media.mobile) appendSource(media.mobile, { media: MOBILE_MEDIA });
    appendSource(media.src);
  }

  videoObserver.observe(video);
  return video;
}

/* Construye la imagen dentro de su marco cuando el marco entra en pantalla.
   watchImage cubre la cadena de respaldo (data-fallback -> placeholder) y
   los estados media-pending/loaded/error que pintan el spinner del marco y
   el aviso de error. `aspect` fija el ratio real en el <img> (el CSS de
   algunas rejillas, como mods, fuerza 16/9 por defecto y el inline lo
   sobrescribe). */
export function mountImage(frame, media, { sizes, className, aspect = null }) {
  lazyFill(frame, () => {
    const { picture, img } = buildPicture(media, { sizes, className });
    if (aspect) img.style.aspectRatio = aspect;
    watchImage(img, { container: frame, fallback: media.fallback || "" });
    frame.appendChild(picture);
  });
}

/* El poster del vídeo también se asigna en diferido: si la tarjeta no llega
   a verse, ni siquiera se descarga la miniatura. */
export function attachPoster(frame, media, video) {
  if (!media.poster) return;
  lazyFill(frame, () => {
    video.poster = media.poster;
  });
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
  /* Los errores de la selección original pueden llegar tarde (el navegador
     sigue procesando candidatos de <picture>/srcset cuando el respaldo ya se
     está mostrando). Si el <img> ya decodifica una imagen, se conserva: nunca
     se sustituye un medio visible por un error ajeno. */
  if (
    img.naturalWidth > 0 &&
    (img.dataset.fallbackUsed === "true" || img.dataset.placeholderUsed === "true")
  ) {
    return true;
  }

  /* Si el <img> lleva srcset (p. ej. el logo del encabezado) o vive dentro de
     un <picture>, el navegador seguiría eligiendo los candidatos originales
     aunque cambiemos src: hay que retirar srcset/sizes y los <source> del
     picture para que la URL de respaldo surta efecto de verdad. */
  const applyFallbackSrc = (url) => {
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.removeAttribute("loading");
    img
      .closest("picture")
      ?.querySelectorAll("source")
      .forEach((source) => source.remove());
    img.src = url;
  };

  const fallback = img.dataset.fallback;
  if (fallback && img.dataset.fallbackUsed !== "true") {
    img.dataset.fallbackUsed = "true";
    img.dataset.fallbackTransition = "true";
    applyFallbackSrc(fallback);
    queueMicrotask(() => delete img.dataset.fallbackTransition);
    return true;
  }

  const placeholder = img.dataset.placeholder || (img.dataset.fallback ? MEDIA_PLACEHOLDER : "");
  if (placeholder && img.dataset.placeholderUsed !== "true") {
    img.dataset.placeholderUsed = "true";
    img.dataset.fallbackTransition = "true";
    applyFallbackSrc(placeholder);
    queueMicrotask(() => delete img.dataset.fallbackTransition);
    return true;
  }
  return false;
}

/* Registra tanto la reserva de espacio como los estados de carga/error de una
   imagen. El placeholder local es el último recurso: no depende de Nexus ni
   itch.io, así que también funciona durante una caída de esos CDN. */
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
  // pero no las lazy que todavía no se han construido.
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
  if (video.readyState >= 1) setMediaState(container, "loaded");
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
  // El espacio entre el texto y la flecha se añade aquí, y no pegado a cada
  // etiqueta del manifest ("View on Nexus "), para que todas las tarjetas
  // separen la flecha igual.
  link.append(document.createTextNode(label), document.createTextNode(" "));
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
    if (!el || el.tagName !== "IMG") return false;
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
    if (!event.target || !event.target.closest) return;
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
