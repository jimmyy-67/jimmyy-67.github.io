(() => {
  const VIDEO_RE = /\.(mp4|mov)$/i;

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

  function openExternalLink(url) {
    secureExternalLink(document.createElement("a"), url).click();
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
  function buildGallery() {
    const gallery = window.GALLERY || {};
    galleryFlat = [];
    for (const [category, items] of Object.entries(gallery)) {
      const grid = document.getElementById(`grid-${category}`);
      if (!grid) continue;
      for (const item of items) {
        const raw = item.file;
        const finalSrc =
          raw.startsWith("videos/") ||
          raw.startsWith("img/") ||
          raw.startsWith("/") ||
          raw.startsWith("http")
            ? raw
            : `img/portfolio/${raw}`;
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
    if (!lightbox.classList.contains("open")) {
      lightboxTrigger = document.activeElement;
    }
    lbIndex = galleryFlat.indexOf(src);
    if (lbIndex === -1) lbIndex = 0;
    renderLightbox(src);
  }

  function renderLightbox(src) {
    lightboxMedia.innerHTML = "";

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
    if (!lightbox.classList.contains("open") || galleryFlat.length === 0) return;
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
      if (fallback)
        img.addEventListener("error", () => {
          img.src = fallback;
        });
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

      const card = document.createElement("div");
      card.className = "card";
      card._mod = mod;
      card.dataset.modId = nexusId(url);
      card.addEventListener("click", () => openExternalLink(url));

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

        if (fallback) {
          const onError = () => {
            img.removeEventListener("error", onError);
            img.classList.add("card-thumb--fallback");
            img.src = fallback;
          };
          img.addEventListener("error", onError);
        }
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
      link.innerHTML = 'View on Nexus <span class="arrow">↗</span>';
      link.addEventListener("click", (e) => e.stopPropagation());
      actions.appendChild(link);

      if (repo) {
        const repoLink = secureExternalLink(document.createElement("a"), repo);
        repoLink.className = "card-link";
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

  // Cifras reales de la API de Nexus (se regeneran a diario en GitHub Actions).
  // Si el archivo no existe todavía, se mantienen los valores de manifest.js.
  async function loadModStats() {
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
})();

/* ===== Fallback de imágenes =====
   Sustituye al atributo inline `onerror`: si una imagen falla, se usa la
   ruta indicada en `data-fallback`. El listener de captura atiende errores
   a partir de ahora y el barrido final cubre los que ocurrieron antes de
   que este script cargara (p. ej. el logo, que está arriba del todo). */
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
