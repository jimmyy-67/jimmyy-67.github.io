/* ============================================================================
 * main.js - punto de entrada único (type="module")
 *
 * Orquesta los módulos: cada uno comprueba sus propios elementos del DOM y
 * se desactiva en silencio si faltan (programación defensiva), así que el
 * orden solo importa en dos casos: el lightbox debe existir antes de que la
 * galería registre sus elementos, y el router se arranca al final porque la
 * primera ruta puede cargar vistas perezosas (Portfolio, Projects, Mods).
 * ==========================================================================*/
import { hardenExternalLinks, initImageFallback } from "./utils.js";
import { initLightbox } from "./lightbox.js";
import { initGallery, initPortfolioView } from "./gallery.js";
import { loadWorks } from "./projects.js";
import { loadMods } from "./mods.js";
import { renderAboutStats, ensureStats } from "./stats.js";
import { initNavigation } from "./navigation.js";
import { initContact } from "./contact.js";

hardenExternalLinks();
initImageFallback();
initLightbox();
initGallery();
renderAboutStats();
initContact();
initNavigation({
  onViewChange: (view) => {
    /* Cada vista pesada se construye la primera vez que se visita; los
       medios dentro de cada vista, además, al entrar en el viewport. */
    if (view === "portfolio") initPortfolioView();
    if (view === "projects") loadWorks();
    if (view === "mods") {
      loadMods();
      ensureStats();
    }
    if (view === "about") {
      renderAboutStats();
      ensureStats();
    }
  }
});
