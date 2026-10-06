/* ============================================================================
 * main.js - punto de entrada único (type="module")
 *
 * Orquesta los módulos: cada uno comprueba sus propios elementos del DOM y
 * se desactiva en silencio si faltan (programación defensiva), así que el
 * orden solo importa en dos casos: el lightbox debe existir antes de que la
 * galería registre sus elementos, y el router se arranca al final porque la
 * primera ruta puede cargar vistas perezosas (Projects, Mods).
 * ==========================================================================*/
import { hardenExternalLinks, initExternalServiceFeedback, initImageFallback } from "./utils.js";
import { initLightbox } from "./lightbox.js";
import { initGallery } from "./gallery.js";
import { loadWorks } from "./projects.js";
import { loadMods } from "./mods.js";
import { loadModStats, renderAboutStats } from "./stats.js";
import { initNavigation } from "./navigation.js";
import { initContact } from "./contact.js";

// El HTML conserva contenido estático mientras no haya JavaScript. Solo al
// arrancar el módulo se activa la interfaz enriquecida y se ocultan esos
// respaldos, evitando una pantalla vacía si el script no llega a ejecutarse.
document.body.classList.replace("no-js", "js-ready");

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
    if (view === "projects") loadWorks();
    if (view === "mods") loadMods();
  }
});
