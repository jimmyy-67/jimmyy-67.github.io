(() => {
  const VIDEO_RE = /\.(mp4|mov)$/i;

  /* ===========================================================================
   * Resiliencia de la multimedia
   *
   * Las carátulas de mods y proyectos son copias locales de lo que se publica
   * en Nexus Mods o itch.io: el sitio nunca depende de que esos dominios
   * sirvan imágenes. Aun así, un archivo puede faltar, renombrarse o cortarse
   * a medio descargar, así que cada imagen sigue esta cadena:
   *
   *   original  ->  data-fallback (p. ej. .webp -> .png)  ->  marcador genérico
   *
   * y cada elemento anuncia su estado en `data-state` (loading | ready |
   * error) para que styles.css pinte el esqueleto o el hueco de error.
   * =========================================================================*/
  const PLACEHOLDER_SRC = "img/placeholder.svg";
  // Solo la multimedia grande se sustituye por el marcador; los iconos
  // decorativos que fallan los oculta el CSS, porque su texto ya los explica.
  const PLACEHOLDER_TARGETS = ".card-thumb, .project-image";

  function handleImageError(img) {
    if (img.dataset.state === "error") return; // ya resuelto: evita bucles
    const fallback = img.dataset.fallback;
    if (fallback && !img.src.endsWith(fallback)) {
      if (img.classList.contains("card-thumb")) img.classList.add("card-thumb--fallback");
      img.src = fallback;
      return;
    }
    img.dataset.state = "error";
    if (!img.matches(PLACEHOLDER_TARGETS)) return;
    img.alt = img.alt ? `${img.alt} (image unavailable)` : "Image unavailable";
    img.src = PLACEHOLDER_SRC;
  }

  // El evento `error` de <img> no burbujea: hay que escucharlo en captura.
  // Sustituye al atributo inline `onerror`, que la CSP no permite.
  document.addEventListener(
    "error",
    (event) => {
      if (event.target instanceof HTMLImageElement) handleImageError(event.target);
    },
    true
  );
  // Barrido inicial para las imágenes que ya habían fallado antes de que este
  // script se ejecutara (el logo, por ejemplo, está al principio del HTML).
  document.querySelectorAll("img[data-fallback]").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) handleImageError(img);
  });

  /** Marca el estado de una imagen para que el CSS enseñe el esqueleto. */
  function watchImage(img) {
    if (img.complete && img.naturalWidth > 0) {
      img.dataset.state = "ready";
      return;
    }
    img.dataset.state = "loading";
    img.addEventListener("load", () => {
      if (img.dataset.state !== "error") img.dataset.state = "ready";
    });
  }

  /** Lo mismo para los clips: el hueco no se queda negro mientras descargan. */
  function watchVideo(video) {
    video.dataset.state = "loading";
    const ready = () => {
      if (video.dataset.state !== "error") video.dataset.state = "ready";
    };
    video.addEventListener("loadedmetadata", ready);
    video.addEventListener("loadeddata", ready);
    video.addEventListener("error", () => {
      video.dataset.state = "error";
    });
  }

  /**
   * Aplica en un único lugar las garantías de aislamiento y privacidad de
   * todos los enlaces que abren una pestaña nueva.
   */
  function secureExternalLink(link, url = link.href) {
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  // También protege enlaces declarativos presentes en index.html y evita que
  // una futura omisión de `rel` llegue al navegador.
  document.querySelectorAll('a[target="_blank"]').forEach((link) => secureExternalLink(link));

  /* lazy-load images */
  const imgObserver = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target;
        el.src = el.dataset.src;
        el.removeAttribute("data-src");
        imgObserver.unobserve(el);
      }
    },
    { rootMargin: "300px" }
  );

  /* video observer: los clips solo se reproducen al pasar el ratón o al
     recibir el foco; en cuanto salen de pantalla se pausan para no gastar
     CPU ni ancho de banda en algo que nadie está viendo. */
  const videoObserver = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) en.target.pause();
      }
    },
    { rootMargin: "200px", threshold: 0.25 }
  );

  /* build gallery cards */
  let galleryFlat = [];
  let galleryMeta = [];

  /** Las rutas desnudas de la galería cuelgan de img/portfolio. */
  function resolveMedia(raw) {
    if (!raw) return "";
    return raw.startsWith("videos/") ||
      raw.startsWith("img/") ||
      raw.startsWith("/") ||
      raw.startsWith("http")
      ? raw
      : `img/portfolio/${raw}`;
  }

  function buildGallery() {
    const gallery = window.GALLERY || {};
    galleryFlat = [];
    galleryMeta = [];
    for (const [category, items] of Object.entries(gallery)) {
      const grid = document.getElementById(`grid-${category}`);
      if (!grid) continue;
      for (const item of items) {
        const finalSrc = resolveMedia(item.file);
        galleryFlat.push(finalSrc);
        galleryMeta.push(item);
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
          watchVideo(video);
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
          // Respaldo de la misma captura (p. ej. el .png junto al .webp).
          const fileFallback = resolveMedia(item.fileFallback);
          if (fileFallback) img.dataset.fallback = fileFallback;
          watchImage(img);
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
  }
  buildGallery();

  /* gallery tabs: estado visual, ARIA y foco se actualizan juntos */
  const galleryTablist = document.querySelector(".gallery-tabs[role='tablist']");
  const galleryTabs = galleryTablist
    ? Array.from(galleryTablist.querySelectorAll("[role='tab']"))
    : [];

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
  galleryTablist?.addEventListener("keydown", (event) => {
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

  /* lightbox with keyboard navigation and modal focus management */
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

  function openLightbox(src) {
    if (!lightbox.open) {
      lightboxTrigger = document.activeElement;
    }
    lbIndex = galleryFlat.indexOf(src);
    if (lbIndex === -1) lbIndex = 0;
    renderLightbox(src);
  }

  function showLightboxError() {
    lightboxMedia.textContent = "";
    lightboxMedia.dataset.state = "error";
    const message = document.createElement("p");
    message.className = "lightbox-error";
    message.textContent =
      "This file could not be loaded. Check your connection and try again, or press Escape to go back to the gallery.";
    lightboxMedia.appendChild(message);
  }

  function renderLightbox(src) {
    lightboxMedia.innerHTML = "";
    lightboxMedia.dataset.state = "loading";
    const item = galleryMeta[lbIndex] || {};
    const position = galleryFlat.length ? `Imagen ${lbIndex + 1} de ${galleryFlat.length}` : "";
    lightbox.setAttribute(
      "aria-label",
      [item.title || "Vista previa multimedia", item.description || "", position]
        .filter(Boolean)
        .join(". ")
    );

    // El visor a tamaño completo descarga el archivo original: mientras
    // llega se ve un spinner y, si no llega, un mensaje en vez de un hueco
    // negro sin explicación.
    const ready = () => {
      if (lightboxMedia.dataset.state !== "error") lightboxMedia.dataset.state = "ready";
    };

    let el;
    if (VIDEO_RE.test(src)) {
      el = document.createElement("video");
      el.muted = true;
      el.loop = true;
      el.autoplay = true;
      el.controls = true;
      el.playsInline = true;
      el.addEventListener("loadeddata", ready);
      el.addEventListener("error", showLightboxError);
      el.src = src;
    } else {
      el = document.createElement("img");
      el.alt = "";
      el.addEventListener("load", ready);
      el.addEventListener("error", showLightboxError);
      el.src = src;
    }

    lightboxMedia.appendChild(el);
    if (!lightbox.open) lightbox.showModal();
    lightbox.classList.add("open");
    lightboxClose.focus();
  }

  function closeLightbox() {
    if (!lightbox.open) return;

    lightbox.classList.remove("open");
    lightboxMedia.innerHTML = "";
    delete lightboxMedia.dataset.state;
    lightbox.close();

    const trigger = lightboxTrigger;
    lightboxTrigger = null;
    if (trigger && trigger.isConnected && typeof trigger.focus === "function") {
      trigger.focus();
    }
  }

  function navLightbox(dir) {
    if (!lightbox.open || galleryFlat.length === 0) return;
    lbIndex = (lbIndex + dir + galleryFlat.length) % galleryFlat.length;
    renderLightbox(galleryFlat[lbIndex]);
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

  /* works (projects) */
  function youtubeThumb(url) {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
    return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
  }

  function makeProjectVisual(work, thumb, fallback) {
    const visual = document.createElement("div");
    visual.className = "project-visual";
    if (thumb) {
      visual.classList.add("project-visual--image");
      const img = document.createElement("img");
      img.className = "project-image";
      img.dataset.src = thumb;
      img.alt = work.title || "";
      img.loading = "lazy";
      img.decoding = "async";
      // La cadena de respaldo la gestiona el manejador global de errores:
      // data-fallback primero y, si tampoco está, el marcador genérico.
      if (fallback) img.dataset.fallback = fallback;
      watchImage(img);
      imgObserver.observe(img);
      visual.appendChild(img);
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
      const thumb = work.thumbnail || youtubeThumb(url) || "";
      const fallback = work.thumbnailFallback || "";
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
      panel.appendChild(makeProjectVisual(work, thumb, fallback));

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
      const link = secureExternalLink(document.createElement("a"), url);
      link.className = "project-link";
      // Identifica el servicio externo (itch.io, GitHub, Discord, Fandom...)
      // para poder avisar con un mensaje claro si no se puede abrir.
      if (work.service) link.dataset.service = work.service;
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
      if (event.key === "ArrowDown" || event.key === "ArrowRight")
        next = (current + 1) % tabs.length;
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
    buildWorks(window.WORKS || []);
  }

  /* mods (Nexus Mods) */
  // Datos en vivo de stats.json (los rellena la API de Nexus vía GitHub Actions).
  let liveStats = null;
  const modsById = new Map();

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
      live: Boolean(live),
      uniqueDownloads: live?.uniqueDownloads ?? backup.uniqueDownloads ?? null,
      totalDownloads: live?.totalDownloads ?? null
    };
  }

  function renderModStats(card) {
    const line = card.querySelector(".mod-statline");
    if (!line) return;
    const s = statsFor(modsById.get(card.dataset.modId) || {});
    if (s.uniqueDownloads === null || s.uniqueDownloads === undefined) {
      line.hidden = true;
      return;
    }
    line.hidden = false;
    line.textContent = `${s.uniqueDownloads.toLocaleString()} unique downloads`;
    // La cifra se enseña igual venga de la API o del respaldo estático, pero
    // el tooltip deja claro de dónde sale para no dar gato por liebre.
    if (!s.live) line.title = "Last saved figure: the live numbers could not be loaded.";
    else if (s.totalDownloads !== null)
      line.title = `Total downloads on Nexus: ${s.totalDownloads.toLocaleString()}`;
    else line.title = "";
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
    if (mods)
      mods.textContent = String((window.MODS || []).filter((m) => m.hidden !== true).length);
  }
  renderAboutStats();

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

      const card = document.createElement("article");
      card.className = "card";
      card.dataset.modId = nexusId(url);
      modsById.set(card.dataset.modId, mod);

      const thumb = mod.thumbnail || "";
      const fallback = mod.thumbnailFallback || "";
      if (thumb) {
        const img = document.createElement("img");
        img.className = "card-thumb";
        img.dataset.src = thumb;
        img.alt = title;
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

        // .webp -> .png -> marcador genérico, todo desde el manejador global.
        if (fallback) img.dataset.fallback = fallback;
        watchImage(img);
        imgObserver.observe(img);
        card.appendChild(img);
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

      const link = secureExternalLink(document.createElement("a"), url);
      link.className = "card-link";
      link.dataset.service = "nexus";
      link.innerHTML = 'View on Nexus <span class="arrow">↗</span>';
      link.addEventListener("click", (e) => e.stopPropagation());
      actions.appendChild(link);

      if (repo) {
        const repoLink = secureExternalLink(document.createElement("a"), repo);
        repoLink.className = "card-link";
        repoLink.dataset.service = "github";
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

  /* ===========================================================================
   * stats.json: carga, frescura y errores
   *
   * El workflow `nexus-stats.yml` regenera stats.json cada día con la API
   * oficial de Nexus Mods. El navegador solo lo lee, y el ciclo completo es
   * visible para el visitante:
   *
   *   - cargando -> esqueleto en la pastilla del perfil + "Syncing…";
   *   - al día   -> cifras reales + cuándo se sincronizaron por última vez;
   *   - antiguas -> el mismo texto, en ámbar, avisando de que pueden haber
   *                 cambiado (más de STALE_AFTER_DAYS sin sincronizar);
   *   - error    -> mensaje visible y botón de reintento, manteniendo a la
   *                 vista las cifras estáticas de respaldo (manifest.js e
   *                 index.html). Nunca se falla en silencio.
   * =========================================================================*/
  const STATS_TIMEOUT_MS = 10_000;
  const DAY_MS = 86_400_000;
  // El workflow corre a diario: una semana sin sincronizar significa que algo
  // lleva roto varios intentos (clave caducada, API caída, cron desactivado).
  const STALE_AFTER_DAYS = 7;
  const RELATIVE_UNITS = [
    ["year", 365 * DAY_MS],
    ["month", 30 * DAY_MS],
    ["day", DAY_MS],
    ["hour", 3_600_000],
    ["minute", 60_000]
  ];

  const statsStatusBoxes = ["mods-stats-status", "about-stats-status"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  let statsRequest = null;
  let statsLoaded = false;
  let statsFailed = false;

  function relativeTime(date) {
    const diff = date.getTime() - Date.now();
    const abs = Math.abs(diff);
    if (abs < 60_000) return "just now";
    try {
      // `always` en vez de `auto`: "1 day ago" encaja en la frase mucho
      // mejor que "yesterday" o "last month" y es más preciso.
      const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always" });
      for (const [unit, ms] of RELATIVE_UNITS) {
        if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
      }
    } catch {
      /* Intl incompleto: se cae a la fecha absoluta */
    }
    return `on ${date.toISOString().slice(0, 10)}`;
  }

  function absoluteTime(date) {
    try {
      return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
        date
      );
    } catch {
      return date.toISOString();
    }
  }

  /** Fecha de la última sincronización completa que declara stats.json. */
  function statsDate(data) {
    const raw = data?.syncedAt || data?.generatedAt || null;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function retryButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stats-retry";
    button.textContent = "Retry";
    button.addEventListener("click", () => loadModStats({ force: true }));
    return button;
  }

  /** Pinta el mismo estado en la vista de Mods y en la de About. */
  function renderStatsStatus(state, date = null) {
    for (const box of statsStatusBoxes) {
      box.textContent = "";
      box.dataset.state = state;
      box.hidden = false;

      if (state === "loading") {
        const spinner = document.createElement("span");
        spinner.className = "stats-spinner";
        spinner.setAttribute("aria-hidden", "true");
        box.append(spinner, document.createTextNode("Syncing live figures from Nexus Mods…"));
        continue;
      }

      if (state === "error") {
        box.append(
          document.createTextNode(
            "Live Nexus Mods figures could not be loaded, so these are the last saved numbers."
          ),
          retryButton()
        );
        continue;
      }

      if (!date) {
        box.append(document.createTextNode("Live figures from the Nexus Mods API."));
        continue;
      }

      const when = document.createElement("time");
      when.dateTime = date.toISOString();
      when.textContent = relativeTime(date);
      when.title = absoluteTime(date);

      if (state === "stale") {
        box.append(
          document.createTextNode("Nexus Mods figures last synced "),
          when,
          document.createTextNode(" — they may be out of date.")
        );
      } else {
        box.append(
          document.createTextNode("Nexus Mods figures updated "),
          when,
          document.createTextNode(".")
        );
      }
    }
  }

  /** Esqueleto y atenuado mientras la petición está en vuelo. */
  function setStatsSyncing(active) {
    const dl = document.getElementById("about-dl");
    if (dl) {
      if (active) dl.dataset.syncing = "true";
      else delete dl.dataset.syncing;
    }

    const box = document.getElementById("mods-profile");
    if (!box || liveStats) return; // ya hay un total real en pantalla
    box.textContent = "";
    if (!active) {
      box.hidden = true;
      return;
    }
    const ghost = statPill("", {});
    ghost.classList.add("mod-stat--skeleton");
    ghost.setAttribute("aria-hidden", "true");
    box.appendChild(ghost);
    box.hidden = false;
  }

  async function fetchStats() {
    // `AbortController` evita que una red muy lenta deje el esqueleto girando
    // para siempre: a los 10 s se considera fallo y se enseña el error.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STATS_TIMEOUT_MS);
    try {
      const res = await fetch(`stats.json?t=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || typeof data !== "object" || !data.mods) {
        throw new Error("stats.json no trae datos de mods");
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  // Cifras reales de la API de Nexus (se regeneran a diario en GitHub Actions).
  // Si el archivo falla o no existe todavía, se mantienen los valores de
  // respaldo de manifest.js y del propio index.html.
  function loadModStats({ force = false } = {}) {
    if (statsRequest) return statsRequest;
    if (statsLoaded && !force) return Promise.resolve(liveStats);

    renderStatsStatus("loading");
    setStatsSyncing(true);

    statsRequest = fetchStats()
      .then((data) => {
        liveStats = data;
        statsLoaded = true;
        statsFailed = false;
        document.querySelectorAll("#mods-grid .card").forEach(renderModStats);
        renderModsProfile();
        renderAboutStats();

        const date = statsDate(data);
        const stale = date ? Date.now() - date.getTime() > STALE_AFTER_DAYS * DAY_MS : false;
        renderStatsStatus(stale ? "stale" : "fresh", date);
        return data;
      })
      .catch((error) => {
        statsFailed = true;
        console.warn("stats.json no disponible:", error.message);
        renderStatsStatus("error");
        renderModsProfile(); // retira el esqueleto; el perfil queda oculto
        return null;
      })
      .finally(() => {
        statsRequest = null;
        setStatsSyncing(false);
      });

    return statsRequest;
  }

  let modsLoaded = false;
  function loadMods() {
    if (modsLoaded) return;
    modsLoaded = true;
    applyNexusLinks();
    buildMods(window.MODS || []);
    loadModStats();
  }

  /* routing: hash -> view */
  const links = document.querySelectorAll("#nav a");
  const allViews = ["portfolio", "projects", "mods", "about", "contact"];
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
    if (view === "projects") loadWorks();
    if (view === "mods") loadMods();
    // About también enseña el acumulado de descargas: merece las cifras
    // en vivo (y su indicador de frescura) aunque no se abra Mods.
    if (view === "about") loadModStats();
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
      const status = document.getElementById("discord-status");
      if (status) status.textContent = "Discord username copied to clipboard.";
      const prev = discordBtn.textContent;
      discordBtn.textContent = "Copied!";
      setTimeout(() => {
        discordBtn.textContent = prev;
      }, 1500);
    };
    discordBtn.addEventListener("click", copyDiscord);
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

  /* ===========================================================================
   * Servicios externos: avisos amables cuando no se puede llegar
   *
   * El sitio enlaza a Nexus Mods, itch.io, GitHub, Discord y Fandom. Desde el
   * navegador no se puede comprobar si uno de esos destinos responde: la CSP
   * (`connect-src 'self'`) y el propio CORS lo impiden, y sondear dominios de
   * terceros en cada visita sería además una fuga de privacidad. Lo que sí se
   * detecta es que el visitante se ha quedado sin conexión, que es la causa
   * más frecuente de que un enlace "no haga nada": en ese caso se explica qué
   * pasa y se ofrece la dirección alternativa en vez de abrir una pestaña en
   * blanco. La disponibilidad real de cada destino la vigila cada semana el
   * workflow `site-integrity.yml` (npm run check-links).
   * =========================================================================*/
  const SERVICES = {
    nexus: {
      label: "Nexus Mods",
      hint: "The profile is at nexusmods.com/profile/qopp."
    },
    itch: {
      label: "itch.io",
      hint: "The games are at j1mmyy.itch.io."
    },
    github: {
      label: "GitHub",
      hint: "The repositories are at github.com/jimmyy-67."
    },
    discord: {
      label: "Discord",
      hint: "The invite is discord.gg/MBr2QaUfBg, and email (deeoqe@gmail.com) always works."
    },
    fandom: {
      label: "the Refished Wiki",
      hint: "The wiki is at feed-and-grow-refished.fandom.com."
    }
  };

  const notice = document.getElementById("site-notice");
  const noticeText = document.getElementById("site-notice-text");
  const noticeClose = document.getElementById("site-notice-close");
  let noticeTimer = null;
  let noticeKey = "";

  function showNotice(message, { tone = "info", key = "", timeout = 0 } = {}) {
    if (!notice || !noticeText) return;
    clearTimeout(noticeTimer);
    noticeKey = key;
    noticeText.textContent = message;
    notice.dataset.tone = tone;
    notice.hidden = false;
    if (timeout) noticeTimer = setTimeout(() => hideNotice(key), timeout);
  }

  // Con `key` solo se cierra el aviso si sigue siendo el que se mostró: así un
  // temporizador viejo no tapa un mensaje más reciente.
  function hideNotice(key = "") {
    if (!notice) return;
    if (key && noticeKey !== key) return;
    clearTimeout(noticeTimer);
    notice.hidden = true;
    noticeKey = "";
  }

  noticeClose?.addEventListener("click", () => hideNotice());

  const isOffline = () => navigator.onLine === false;

  function syncConnectivity() {
    if (!isOffline()) {
      hideNotice("offline");
      return;
    }
    showNotice(
      "You appear to be offline. Links to Nexus Mods, itch.io, GitHub, Discord and the wiki will not open, and the live download figures cannot be refreshed. Everything else on this page keeps working.",
      { tone: "warn", key: "offline" }
    );
  }

  addEventListener("offline", syncConnectivity);
  addEventListener("online", () => {
    hideNotice("offline");
    // Al volver la conexión se reintenta lo que había quedado a medias.
    if (statsFailed) loadModStats({ force: true });
  });
  syncConnectivity();

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest("a[data-service]");
    if (!link) return;
    const service = SERVICES[link.dataset.service];
    if (!service || !isOffline()) return;
    event.preventDefault();
    showNotice(`${service.label} cannot open while you are offline. ${service.hint}`, {
      tone: "warn",
      key: "service",
      timeout: 9000
    });
  });

  /* ===== Google Fonts =====
   * La pila de `--font-sans` ya resuelve la caída del servicio: si
   * fonts.googleapis.com no responde, el navegador usa la tipografía del
   * sistema. Esto solo avisa al CSS para que afloje el interletraje de los
   * titulares, que sin Space Grotesk quedarían demasiado apretados. */
  function flagWebfont() {
    const fonts = document.fonts;
    if (!fonts || typeof fonts.check !== "function") return;
    const mark = () => {
      try {
        document.documentElement.dataset.fonts = fonts.check('700 1rem "Space Grotesk"')
          ? "webfont"
          : "fallback";
      } catch {
        /* FontFaceSet incompleto: se deja la pila del sistema sin marcar */
      }
    };
    fonts.ready?.then(mark).catch(mark);
    // Red muy lenta: a los 3 s se decide con lo que haya, y si la fuente
    // termina de llegar después, `fonts.ready` vuelve a corregir la marca.
    setTimeout(mark, 3000);
  }
  flagWebfont();
})();
