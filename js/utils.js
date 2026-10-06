/* ============================================================================
 * utils.js - helpers compartidos entre módulos
 *
 * Observadores perezosos, creación de enlaces con flecha, resolución de rutas
 * de la galería, fallback de imágenes vía data-fallback y construcción de
 * medios responsivos (<picture> AVIF/WebP con srcset, <video> con variante
 * móvil + poster) bajo carga diferida.
 * ==========================================================================*/

export const VIDEO_RE = /\.(mp4|mov)(?:\?|$)/i;
const IMAGE_RE = /\.(avif|webp|png|jpe?g)(?:\?|$)/i;

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
   vía data-fallback (lo intercambia initImageFallback). */
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

/* Construye la imagen dentro de su marco cuando el marco entra en pantalla;
   al cargar (o fallar, que activa el fallback PNG) se apaga el esqueleto.
   `aspect` fija el ratio real en el <img> (el CSS de algunas rejillas, como
   mods, fuerza 16/9 por defecto y el inline lo sobrescribe). */
export function mountImage(frame, media, { sizes, className, aspect = null }) {
  lazyFill(frame, () => {
    const { picture, img } = buildPicture(media, { sizes, className });
    if (aspect) img.style.aspectRatio = aspect;
    const loaded = () => frame.classList.add("is-loaded");
    img.addEventListener("load", loaded);
    img.addEventListener("error", () => {
      loaded();
      /* El PNG de respaldo lleva un fondo tenue propio (como antes). */
      if (media.fallback && className === "card-thumb") {
        img.classList.add("card-thumb--fallback");
      }
    });
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

/**
 * Aplica en un único lugar las garantías de aislamiento y privacidad de
 * todos los enlaces que abren una pestaña nueva.
 */
export function secureExternalLink(link, url = link.href) {
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
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
      if (e.target && e.target.tagName === "IMG") imgFallback(e.target);
    },
    true
  );
  document.querySelectorAll("img[data-fallback]").forEach((el) => {
    if (el.complete && el.naturalWidth === 0) imgFallback(el);
  });
}
