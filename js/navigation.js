/* ============================================================================
 * navigation.js - router por hash, menú móvil, scroll suave y botón de subir
 * ==========================================================================*/

const ALL_VIEWS = ["portfolio", "projects", "mods", "about", "contact"];

/* routing: hash -> view. `onViewChange` permite al punto de entrada cargar
   vistas perezosas (Projects, Mods) sin acoplar este módulo a ellas. */
function initRouting(onViewChange) {
  const links = document.querySelectorAll("#nav a");
  function route() {
    const hash = location.hash.slice(1);
    const view = ALL_VIEWS.includes(hash) ? hash : "portfolio";
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
    links.forEach((a) => {
      const isCurrent = a.dataset.view === view;
      a.classList.toggle("active", isCurrent);
      if (isCurrent) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (typeof onViewChange === "function") onViewChange(view);
    scrollTo(0, 0);
  }
  addEventListener("hashchange", route);
  route();
}

/* ---------- menú hamburguesa (móvil) ---------- */
function initMenu() {
  const nav = document.getElementById("nav");
  const menuToggle = document.querySelector(".menu-toggle");
  if (!nav || !menuToggle) return;

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

/* back to top button */
function initBackTop() {
  const backTop = document.getElementById("back-top");
  if (!backTop) return;
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
}

export function initNavigation({ onViewChange } = {}) {
  initMenu();
  initBackTop();
  initRouting(onViewChange);
}
