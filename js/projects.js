/* ============================================================================
 * projects.js - renderizado de las tarjetas/paneles de proyectos
 * ==========================================================================*/
import { createArrowLink, imgObserver, watchImage } from "./utils.js";

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
    img.alt = work.thumbnailAlt || work.title || "";
    img.loading = "lazy";
    img.decoding = "async";
    watchImage(img, { container: visual, fallback });
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
    activeTab.scrollIntoView?.({
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
    details.appendChild(
      createArrowLink({
        className: "project-link",
        href: url,
        label: work.linkLabel || "View project"
      })
    );

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
export function loadWorks() {
  if (worksLoaded) return;
  worksLoaded = true;
  buildWorks(window.WORKS || []);
}
