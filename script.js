/* ============================================================================
 * script.js - comportamiento del portfolio (módulo ES)
 *
 * Carga diferida: cada vista inicializa sus recursos solo cuando el usuario
 * navega a ella (route -> initView), y dentro de cada vista los medios se
 * construyen cuando entran en el viewport (IntersectionObserver). Los vídeos
 * no descargan nada hasta que se reproducen: `preload="none"` + `poster`.
 *
 * Medios responsivos: las imágenes usan <picture> con srcset (AVIF/WebP en
 * 640/1024/ancho completo) según `sizes` del contexto; los vídeos eligen la
 * variante `-mobile.mp4` en pantallas pequeñas vía <source media> o cuando el
 * usuario tiene activado el ahorro de datos.
 * ==========================================================================*/
import { WORKS, MODS, GALLERY, NEXUS } from "./manifest.js";

const VIDEO_RE = /\.(mp4|mov)(?:\?|$)/i;
const IMAGE_RE = /\.(avif|webp|png|jpe?g)(?:\?|$)/i;
/* Breakpoint móvil del sitio (el mismo del menú hamburguesa en styles.css). */
const MOBILE_MEDIA = "(max-width: 700px)";
const VARIANT_WIDTHS = [640, 1024];

/* ---------- carga diferida bajo demanda ---------- */
/* Un solo observer para todo medio perezoso: al entrar en el viewport (con un
   margen de 300px) se ejecuta su constructor. Si el navegador no soporta
   IntersectionObserver, se construye directamente. */
const lazyObserver =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target;
            lazyObserver.unobserve(el);
            if (typeof el.lazyFill === "function") el.lazyFill();
          }
        },
        { rootMargin: "300px" }
      )
    : null;

function lazyFill(el, fill) {
  if (!lazyObserver) {
    fill();
    return;
  }
  el.lazyFill = fill;
  lazyObserver.observe(el);
}

/* video observer: los clips solo se reproducen al pasar el ratón o al
   recibir el foco; en cuanto salen de pantalla se pausan para no gastar
   CPU ni ancho de banda en algo que nadie está viendo. */
const videoObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) entry.target.pause();
    }
  },
  { rootMargin: "200px", threshold: 0.25 }
);

/* ---------- helpers de medios ---------- */
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
   tarjetas y lightbox. */
function mediaFromEntry(item) {
  const raw = item.file || item.thumbnail || "";
  const src =
    !raw ||
    raw.startsWith("videos/") ||
    raw.startsWith("img/") ||
    raw.startsWith("/") ||
    raw.startsWith("http")
      ? raw
      : `img/portfolio/${raw}`;
  const video = VIDEO_RE.test(src);
  return {
    src,
    video,
    width: item.width || null,
    fallback: item.fileFallback || item.thumbnailFallback || null,
    /* En remoto (p. ej. un CDN) no se presuponen variantes locales; solo se
       usan las que declare el propio manifest. */
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
   vía data-fallback (lo intercambia el listener global de errores). */
function buildPicture(media, { sizes, className }) {
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
  img.alt = media.title || "";
  img.decoding = "async";
  /* La construcción ya se difiere al viewport; loading=lazy es el cinturón
     de seguridad extra del propio navegador. */
  img.loading = "lazy";
  img.src = media.src;
  if (media.fallback) img.dataset.fallback = media.fallback;
  picture.appendChild(img);
  return { picture, img };
}

/* Construye la imagen dentro de su marco cuando el marco entra en pantalla;
   al cargar (o fallar, que activa el fallback PNG) se apaga el esqueleto. */
function mountImage(frame, media, { sizes, className }) {
  lazyFill(frame, () => {
    const { picture, img } = buildPicture(media, { sizes, className });
    const loaded = () => frame.classList.add("is-loaded");
    img.addEventListener("load", loaded);
    img.addEventListener("error", loaded);
    frame.appendChild(picture);
  });
}

/* <video> con fuentes selectivas: la variante móvil va primero y solo se
   usa en pantallas pequeñas (o con ahorro de datos); la completa es el
   respaldo por defecto. Con `preload="none"` no se descarga nada hasta que
   el usuario pide reproducir. */
function buildVideo(
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

  /* El poster se asigna en diferido (lazyFill del marco) para no descargar
     ni siquiera la miniatura si la tarjeta no llega a verse. */
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
    /* Ahorro de datos (Save-Data): la versión ligera para cualquier pantalla. */
    appendSource(media.mobile);
  } else {
    /* La variante móvil va primero y solo se aplica en pantallas pequeñas. */
    if (media.mobile) appendSource(media.mobile, { media: MOBILE_MEDIA });
    appendSource(media.src);
  }

  videoObserver.observe(video);
  return video;
}

function attachPoster(frame, media, video) {
  if (!media.poster) return;
  lazyFill(frame, () => {
    video.poster = media.poster;
  });
}

/* ---------- galería (carga por pestaña y por viewport) ---------- */
/* Ancho aproximado de cada tarjeta según su rejilla; alimenta `sizes`. */
const GRID_SIZES = {
  unity: "(min-width: 701px) 588px, 92vw",
  godot: "(min-width: 701px) 360px, 92vw",
  environments: "(min-width: 701px) 360px, 92vw",
  mods: "(min-width: 701px) 1052px, 92vw"
};

const galleryTabs = [];
let galleryMedia = [];
const builtGrids = new Set();

function buildGalleryCard(category, item) {
  const media = mediaFromEntry(item);
  galleryMedia.push(media);

  const card = document.createElement("div");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", item.title || "Open media");
  card.addEventListener("click", () => openLightbox(media));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLightbox(media);
    }
  });

  /* Marco con esqueleto: reserva el hueco y muestra el shimmer hasta que
     el medio está listo (o el poster del vídeo lo cubre). */
  const frame = document.createElement("div");
  frame.className = "media-frame";

  if (media.video) {
    const video = buildVideo(media, { className: "card-thumb" });
    frame.appendChild(video);
    attachPoster(frame, media, video);
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
    const badge = document.createElement("span");
    badge.className = "thumb-badge";
    badge.textContent = "Clip";
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
function buildGalleryGrid(category) {
  if (builtGrids.has(category)) return;
  builtGrids.add(category);
  const grid = document.getElementById(`grid-${category}`);
  const items = (GALLERY || {})[category] || [];
  if (!grid) return;
  for (const item of items) grid.appendChild(buildGalleryCard(category, item));
}

/* gallery tabs: estado visual, ARIA y foco se actualizan juntos */
const galleryTablist = document.querySelector(".gallery-tabs[role='tablist']");

function selectGalleryTab(selectedTab, { moveFocus = false } = {}) {
  galleryTabs.forEach((tab) => {
    const selected = tab === selectedTab;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;

    const panel = document.getElementById(tab.getAttribute("aria-controls"));
    if (panel) panel.hidden = !selected;
  });

  const category = selectedTab?.dataset.tab;
  if (category) buildGalleryGrid(category);
  if (moveFocus) selectedTab.focus();
}

function initGalleryTabs() {
  if (!galleryTablist || galleryTabs.length) return;
  for (const tab of galleryTablist.querySelectorAll("[role='tab']")) {
    galleryTabs.push(tab);
    tab.addEventListener("click", () => selectGalleryTab(tab));
  }

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

  for (const [category, items] of Object.entries(GALLERY || {})) {
    const countEl = galleryTablist.querySelector(`.gallery-tab[data-tab="${category}"] .tab-count`);
    if (countEl) countEl.textContent = String(items.length);
  }
}

/* ---------- lightbox con navegación por teclado y foco modal ---------- */
const lightbox = document.getElementById("lightbox");
const lightboxMedia = lightbox.querySelector(".lightbox-media");
const lightboxClose = lightbox.querySelector(".lightbox-close");
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "video[controls]"
].join(",");
let lbIndex = -1;
let lightboxTrigger = null;

function openLightbox(media) {
  if (!lightbox.classList.contains("open")) {
    lightboxTrigger = document.activeElement;
  }
  lbIndex = Math.max(0, galleryMedia.indexOf(media));
  renderLightbox(media);
}

/* El lightbox pide la máxima calidad disponible: `sizes` a ancho casi total
   de ventana, sobre el mismo srcset de variantes. */
function renderLightbox(media) {
  lightboxMedia.innerHTML = "";
  lightboxMedia.classList.add("is-loading");

  const loaded = () => lightboxMedia.classList.remove("is-loading");

  if (media.video) {
    const video = buildVideo(media, {
      className: "lb-video",
      controls: true,
      autoplay: true,
      preload: "auto"
    });
    if (media.poster) video.poster = media.poster;
    video.addEventListener("loadeddata", loaded);
    video.addEventListener("error", loaded);
    lightboxMedia.appendChild(video);
  } else {
    const { picture, img } = buildPicture(media, { sizes: "94vw", className: "lb-image" });
    img.addEventListener("load", loaded);
    img.addEventListener("error", loaded);
    lightboxMedia.appendChild(picture);
  }

  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");
  lightboxClose.focus();
}

function closeLightbox() {
  if (!lightbox.classList.contains("open")) return;

  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxMedia.innerHTML = "";

  const trigger = lightboxTrigger;
  lightboxTrigger = null;
  if (trigger && trigger.isConnected && typeof trigger.focus === "function") {
    trigger.focus();
  }
}

function navLightbox(dir) {
  if (!lightbox.classList.contains("open") || galleryMedia.length === 0) return;
  lbIndex = (lbIndex + dir + galleryMedia.length) % galleryMedia.length;
  renderLightbox(galleryMedia[lbIndex]);
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

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});
addEventListener("keydown", (event) => {
  if (!lightbox.classList.contains("open")) return;
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

/* ---------- works (projects) ---------- */
function youtubeThumb(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

function makeProjectVisual(work) {
  const visual = document.createElement("div");
  visual.className = "project-visual";

  const thumb = work.thumbnail || youtubeThumb(work.url) || "";
  if (thumb) {
    visual.classList.add("project-visual--image");
    /* El esqueleto reserva la proporción real de la miniatura. */
    if (work.thumbAspect) visual.style.aspectRatio = work.thumbAspect;

    const frame = document.createElement("div");
    frame.className = "media-frame";
    if (work.thumbAspect) frame.style.aspectRatio = work.thumbAspect;
    mountImage(frame, mediaFromEntry({ ...work, thumbnail: thumb }), {
      sizes: "(min-width: 701px) 788px, 92vw",
      className: "project-image"
    });
    visual.appendChild(frame);
    return visual;
  }

  const empty = document.createElement("div");
  empty.className = "project-fallback";
  if (work.icon) {
    const glyph = document.createElement("img");
    glyph.src = work.icon;
    glyph.alt = "";
    empty.appendChild(glyph);
  }
  visual.appendChild(empty);
  return visual;
}

function buildWorks(list) {
  const rail = document.getElementById("projects-rail");
  const stage = document.getElementById("projects-stage");
  if (!rail || !stage || !list.length) return;

  const tabs = [];
  const panels = [];
  const selectWork = (index, focus = false) => {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    const activeTab = tabs[index];
    activeTab.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: focus ? "smooth" : "auto"
    });
    if (focus) activeTab.focus();
  };

  list.forEach((work, index) => {
    const { title = "", description = "", url = "#" } = work;
    const tabId = `project-tab-${index}`;
    const panelId = `project-panel-${index}`;

    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = tabId;
    tab.className = "project-rail-item";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panelId);
    tab.setAttribute("aria-selected", "false");
    tab.tabIndex = -1;
    const indexLabel = document.createElement("span");
    indexLabel.className = "project-rail-index";
    indexLabel.textContent = String(index + 1).padStart(2, "0");
    const tabCopy = document.createElement("span");
    tabCopy.className = "project-rail-copy";
    const tabTitle = document.createElement("span");
    tabTitle.className = "project-rail-title";
    tabTitle.textContent = title;
    const tabMeta = document.createElement("span");
    tabMeta.className = "project-rail-meta";
    tabMeta.textContent = work.kind || "Project";
    tabCopy.append(tabTitle, tabMeta);
    tab.append(indexLabel, tabCopy);
    tab.addEventListener("click", () => selectWork(index));
    rail.appendChild(tab);
    tabs.push(tab);

    const panel = document.createElement("article");
    panel.id = panelId;
    panel.className = "project-panel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tabId);
    panel.hidden = true;
    panel.appendChild(makeProjectVisual(work));

    const details = document.createElement("div");
    details.className = "project-details";
    if (work.status) {
      const status = document.createElement("span");
      status.className = "project-status";
      status.textContent = work.status;
      details.appendChild(status);
    }
    const kind = document.createElement("p");
    kind.className = "project-kind";
    kind.textContent = work.kind || "Project";
    details.appendChild(kind);
    const heading = document.createElement("h3");
    heading.className = "project-title";
    heading.textContent = title;
    details.appendChild(heading);
    if (description) {
      const text = document.createElement("p");
      text.className = "project-description";
      text.textContent = description;
      details.appendChild(text);
    }
    if (Array.isArray(work.tags) && work.tags.length) {
      const tags = document.createElement("div");
      tags.className = "project-tags";
      for (const tag of work.tags) {
        const pill = document.createElement("span");
        pill.className = "project-tag";
        pill.textContent = tag;
        tags.appendChild(pill);
      }
      details.appendChild(tags);
    }
    const link = document.createElement("a");
    link.className = "project-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.append(document.createTextNode(work.linkLabel || "View project"));
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = "↗";
    link.appendChild(arrow);
    details.appendChild(link);

    panel.appendChild(details);
    stage.appendChild(panel);
    panels.push(panel);
  });

  rail.addEventListener("keydown", (event) => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    let next;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectWork(next, true);
  });

  selectWork(0);
}

let worksLoaded = false;
function loadWorks() {
  if (worksLoaded) return;
  worksLoaded = true;
  buildWorks(WORKS || []);
}

/* ---------- mods (Nexus Mods) ---------- */
// Datos en vivo de stats.json (los rellena la API de Nexus vía GitHub Actions).
let liveStats = null;
let statsPromise = null;

function nexusId(url) {
  const m = /nexusmods\.com\/[^/]+\/mods\/(\d+)/.exec(url || "");
  return m ? m[1] : "";
}

function statPill(text, opts) {
  const { title = "" } = opts || {};
  const span = document.createElement("span");
  span.className = "mod-stat";
  span.textContent = text;
  if (title) span.title = title;
  return span;
}

// stats.json manda; manifest.js solo actúa de respaldo si aún no hay datos.
function statsFor(mod) {
  const live = (liveStats && liveStats.mods && liveStats.mods[nexusId(mod.url)]) || null;
  const backup = mod.stats || {};
  return {
    uniqueDownloads: live?.uniqueDownloads ?? backup.uniqueDownloads ?? null,
    totalDownloads: live?.totalDownloads ?? null
  };
}

function renderModStats(card) {
  const line = card.querySelector(".mod-statline");
  if (!line) return;
  const s = statsFor(card._mod || {});
  if (s.uniqueDownloads === null || s.uniqueDownloads === undefined) {
    line.hidden = true;
    return;
  }
  line.hidden = false;
  line.textContent = `${s.uniqueDownloads.toLocaleString()} unique downloads`;
  line.title =
    s.totalDownloads !== null
      ? `Total downloads on Nexus: ${s.totalDownloads.toLocaleString()}`
      : "";
}

// Totales del perfil (GraphQL v2): solo el acumulado de descargas únicas.
function renderModsProfile() {
  const box = document.getElementById("mods-profile");
  if (!box) return;
  const p = (liveStats && liveStats.profile) || null;
  box.textContent = "";
  if (!p) {
    box.hidden = true;
    return;
  }
  const total = Number(p.uniqueDownloads);
  if (Number.isFinite(total)) {
    box.appendChild(
      statPill(`${total.toLocaleString()} unique downloads from my mods`, {
        title: "Unique downloads across every mod on this profile (Nexus Mods GraphQL v2)"
      })
    );
  }
  box.hidden = box.childElementCount === 0;
}

// Tiles de stats de About: el acumulado vive en stats.json (Nexus en vivo);
// sin red queda el respaldo estático de manifest.js. El conteo de mods sale
// del propio manifest (excluye tarjetas ocultas).
function renderAboutStats() {
  const dl = document.getElementById("about-dl");
  const p = (liveStats && liveStats.profile) || null;
  const total = p ? Number(p.uniqueDownloads) : NaN;
  if (dl && Number.isFinite(total)) dl.textContent = total.toLocaleString();
  const mods = document.getElementById("about-mods");
  if (mods) mods.textContent = String((MODS || []).filter((m) => m.hidden !== true).length);
}

// Cifras reales de la API de Nexus (se regeneran a diario en GitHub Actions).
// Si el archivo no existe todavía, se mantienen los valores de manifest.js.
// Se pide una sola vez, la primera vez que se visita Mods o About.
function ensureStats() {
  if (!statsPromise) {
    statsPromise = (async () => {
      try {
        const res = await fetch(`stats.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data || typeof data !== "object" || !data.mods) return;
        liveStats = data;
        document.querySelectorAll("#mods-grid .card").forEach(renderModStats);
        renderModsProfile();
        renderAboutStats();
      } catch {
        /* sin red o sin stats.json: seguimos con los valores de respaldo */
      }
    })();
  }
  return statsPromise;
}

// El usuario de Nexus vive en manifest.js (NEXUS.profile).
function applyNexusLinks() {
  const link = document.getElementById("nexus-profile-link");
  const nick = NEXUS && NEXUS.profile;
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

    const card = document.createElement("div");
    card.className = "card";
    card._mod = mod;
    card.dataset.modId = nexusId(url);
    card.addEventListener("click", () => window.open(url, "_blank", "noopener"));

    const thumb = mod.thumbnail || "";
    if (thumb) {
      /* Las imágenes de Nexus tienen proporciones muy distintas entre sí:
         el marco adopta la proporción real de la imagen en cuanto se conoce,
         para que encaje perfecta (sin recortes ni bandas). `thumbAspect` en
         manifest.js permite fijarla desde el principio y evitar el salto. */
      const frame = document.createElement("div");
      frame.className = "media-frame";
      if (mod.thumbAspect) {
        frame.style.aspectRatio = mod.thumbAspect;
      } else {
        /* Sin proporción declarada, se mide la imagen al cargar (el evento
           "load" no burbujea, pero sí se captura en fase de captura). */
        const fitRatio = (event) => {
          const img = event.target;
          if (img instanceof HTMLImageElement && img.naturalWidth && img.naturalHeight) {
            frame.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
          }
        };
        frame.addEventListener("load", fitRatio, true);
      }
      mountImage(frame, mediaFromEntry(mod), {
        sizes: GRID_SIZES.mods,
        className: "card-thumb"
      });
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

    const link = document.createElement("a");
    link.className = "card-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.innerHTML = 'View on Nexus <span class="arrow">↗</span>';
    link.addEventListener("click", (e) => e.stopPropagation());
    actions.appendChild(link);

    if (repo) {
      const repoLink = document.createElement("a");
      repoLink.className = "card-link";
      repoLink.href = repo;
      repoLink.target = "_blank";
      repoLink.rel = "noopener";
      repoLink.innerHTML = 'Source <span class="arrow">↗</span>';
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
function loadMods() {
  if (modsLoaded) return;
  modsLoaded = true;
  applyNexusLinks();
  buildMods(MODS || []);
  ensureStats();
}

/* ---------- routing: hash -> view ---------- */
/* Cada vista inicializa sus recursos la primera vez que se visita; las
   secciones estáticas no cargan nada extra. */
const links = document.querySelectorAll("#nav a");
const allViews = ["portfolio", "projects", "mods", "about", "contact"];

function initPortfolioView() {
  initGalleryTabs();
  const active = document.querySelector(".gallery-tab.active");
  const category = active?.dataset.tab || "unity";
  buildGalleryGrid(category);
}

const viewInit = {
  portfolio: initPortfolioView,
  projects: loadWorks,
  mods: loadMods,
  about: () => {
    renderAboutStats();
    ensureStats();
  },
  contact: () => {}
};

function route() {
  const hash = location.hash.slice(1);
  const view = allViews.includes(hash) ? hash : "portfolio";
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  links.forEach((a) => {
    const isCurrent = a.dataset.view === view;
    a.classList.toggle("active", isCurrent);
    if (isCurrent) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  viewInit[view]?.();
  scrollTo(0, 0);
}
addEventListener("hashchange", route);
route();

/* ---------- menú hamburguesa (móvil) ---------- */
const nav = document.getElementById("nav");
const menuToggle = document.querySelector(".menu-toggle");

if (nav && menuToggle) {
  const menuIsOpen = () => nav.classList.contains("open");

  // `aria-expanded` y la clase `.open` se mueven siempre juntas: así el
  // lector de pantalla y lo que se ve en pantalla nunca se contradicen.
  function setMenu(open) {
    nav.classList.toggle("open", open);
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeMenu({ refocus = false } = {}) {
    if (!menuIsOpen()) return;
    setMenu(false);
    if (refocus) menuToggle.focus();
  }

  menuToggle.addEventListener("click", () => setMenu(!menuIsOpen()));

  // Al elegir una sección el panel sobra: taparía la vista recién abierta.
  // Delegado en el nav para que siga valiendo si cambian los enlaces.
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeMenu();
  });

  // Escape cierra y devuelve el foco al botón, que es de donde salió.
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu({ refocus: true });
  });

  // Un clic fuera del panel (y fuera del propio botón, que ya alterna solo)
  // también lo cierra.
  addEventListener("click", (e) => {
    if (!menuIsOpen()) return;
    if (nav.contains(e.target) || menuToggle.contains(e.target)) return;
    closeMenu();
  });

  // En escritorio el nav se muestra siempre, así que al pasar el breakpoint
  // se limpia el estado para no volver a móvil con la X y el panel abiertos.
  // Envuelto por si falta matchMedia: es un extra, no debe tumbar el script.
  const desktop = window.matchMedia?.("(min-width: 701px)");
  desktop?.addEventListener?.("change", (e) => {
    if (e.matches) closeMenu();
  });
}

/* discord copy with fallback */
const discordBtn = document.getElementById("discord-copy");
if (discordBtn) {
  const copyDiscord = async () => {
    const text = "jimy1_";
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("no clipboard");
      }
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* The legacy copy fallback is best-effort. */
      }
      ta.remove();
    }
    const prev = discordBtn.textContent;
    discordBtn.textContent = "Copied!";
    setTimeout(() => {
      discordBtn.textContent = prev;
    }, 1500);
  };
  discordBtn.addEventListener("click", copyDiscord);
  discordBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      copyDiscord();
    }
  });
}

/* back to top button */
const backTop = document.getElementById("back-top");
backTop.addEventListener("click", () => {
  scrollTo({ top: 0, behavior: "smooth" });
});
// show only after scrolling down a bit
const toggleBackTop = () => {
  if (scrollY > 400) backTop.classList.add("visible");
  else backTop.classList.remove("visible");
};
addEventListener("scroll", toggleBackTop, { passive: true });
toggleBackTop();

/* ===== Fallback de imágenes =====
   Sustituye al atributo inline `onerror`: si una imagen falla, se usa la
   ruta indicada en `data-fallback` (el PNG de respaldo). El listener de
   captura atiende errores a partir de ahora y el barrido final cubre los
   que ocurrieron antes de que este script cargara (p. ej. el logo, que
   está arriba del todo). */
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
