/* ============================================================================
 * main.js - punto de entrada único (type="module")
 *
 * Orquesta los módulos: cada uno comprueba sus propios elementos del DOM y
 * se desactiva en silencio si faltan (programación defensiva), así que el
 * orden solo importa en dos casos: el lightbox debe existir antes de que la
 * galería registre sus elementos, y el router se arranca al final porque la
 * primera ruta puede cargar vistas perezosas (Portfolio, Projects, Mods).
 * ==========================================================================*/
import { hardenExternalLinks, initExternalServiceFeedback, initImageFallback } from "./utils.js";
import { initSiteContent } from "./site.js";
import { initLightbox } from "./lightbox.js";
import { initGallery, initPortfolioView } from "./gallery.js";
import { loadWorks } from "./projects.js";
import { loadMods } from "./mods.js";
import { loadModStats, renderAboutStats } from "./stats.js";
import { initNavigation } from "./navigation.js";
import { initContact } from "./contact.js";

// El HTML conserva contenido estático mientras no haya JavaScript. Solo al
// arrancar el módulo se activa la interfaz enriquecida y se ocultan esos
// respaldos, evitando una pantalla vacía si el script no llega a ejecutarse.
document.body.classList.replace("no-js", "js-ready");

/* Primero el contenido: `initSiteContent()` escribe en el DOM los datos de
   `window.SITE` (identidad, contacto y redes) para que el resto de módulos
   —empezando por `hardenExternalLinks()`, que sella los enlaces que abren
   otra pestaña— trabajen ya con los valores definitivos. */
initSiteContent();
hardenExternalLinks();
initImageFallback();
initExternalServiceFeedback();
initLightbox();
initGallery();
renderAboutStats();
void loadModStats();
initContact();
initNavigation({
  onViewChange: (view) => {
    /* Cada vista pesada se construye la primera vez que se visita; los
       medios dentro de cada vista, además, al entrar en el viewport. */
    if (view === "portfolio") initPortfolioView();
    if (view === "projects") loadWorks();
    if (view === "mods") loadMods();
  }
});
