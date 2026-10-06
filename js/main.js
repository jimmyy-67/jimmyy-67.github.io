/* ============================================================================
 * main.js - punto de entrada único (type="module")
 *
 * Orquesta los módulos: cada uno comprueba sus propios elementos del DOM y
 * se desactiva en silencio si faltan (programación defensiva), así que el
 * orden solo importa en dos casos: el lightbox debe existir antes de que la
 * galería registre sus elementos, y el router se arranca al final porque la
 * primera ruta puede cargar vistas perezosas (Projects, Mods).
 * ==========================================================================*/
import { initImageFallback } from "./utils.js";
import { initLightbox } from "./lightbox.js";
import { initGallery } from "./gallery.js";
import { loadWorks } from "./projects.js";
import { loadMods } from "./mods.js";
import { renderAboutStats } from "./stats.js";
import { initNavigation } from "./navigation.js";
import { initContact } from "./contact.js";

initImageFallback();
initLightbox();
initGallery();
renderAboutStats();
initContact();
initNavigation({
  onViewChange: (view) => {
    if (view === "projects") loadWorks();
    if (view === "mods") loadMods();
  }
});
