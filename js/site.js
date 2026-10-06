/* ============================================================================
 * site.js - contenido global centralizado (window.SITE)
 *
 * `manifest.js` es la única fuente de verdad de los datos que aparecen en
 * más de una sección: identidad del sitio, contacto, redes sociales y textos
 * de interfaz compartidos por varios módulos.
 *
 *   - `initSiteContent()` hidrata los elementos de `index.html` marcados con
 *     `data-site="ruta.del.valor"` (título, metadatos, contacto, redes y
 *     enlaces del pie de Mods). El HTML conserva escritos los mismos valores:
 *     son el respaldo sin JavaScript y lo que leen los crawlers, y
 *     `npm run check-links` falla si se desincronizan del manifest.
 *   - `siteValue()` / `siteLabel()` devuelven un dato del manifest con un
 *     valor por defecto, de modo que ningún módulo escribe por su cuenta un
 *     texto repetido (etiquetas de enlaces, contadores, distintivos...).
 * ==========================================================================*/

/* Ruta punteada dentro de window.SITE ("contact.email"). En una lista se
   busca por `key`: "socials.github.url" es la URL de la red con clave
   `github` (así los enlaces del HTML no dependen del orden del array). */
function resolvePath(source, path) {
  return String(path || "")
    .split(".")
    .reduce((accumulated, segment) => {
      if (accumulated === null || accumulated === undefined) return undefined;
      if (Array.isArray(accumulated)) {
        return accumulated.find((entry) => entry && entry.key === segment);
      }
      return accumulated[segment];
    }, source);
}

/* Valor de texto de `SITE` con respaldo si el dato no está en el manifest. */
export function siteValue(path, fallback = "") {
  const value = resolvePath(window.SITE, path);
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

/* Atajo para `SITE.labels.*`: los textos de interfaz compartidos. */
export function siteLabel(path, fallback = "") {
  return siteValue(`labels.${path}`, fallback);
}

/* Entrada de `SITE.socials` por clave (`nexusmods`, `github`, `discord`...). */
export function siteSocial(key) {
  const socials = Array.isArray(window.SITE?.socials) ? window.SITE.socials : [];
  return socials.find((social) => social && social.key === key) || null;
}

export function siteSocialUrl(key, fallback = "") {
  return siteSocial(key)?.url || fallback;
}

/* Hidrata el documento desde `SITE`.
 *  - Por defecto el valor se escribe como texto. En `<meta>` (y en cualquier
 *    elemento que lo pida con `data-site-attr`) se escribe en el atributo.
 *  - `data-site-template` permite envolver el valor (p. ej.
 *    `mailto:{value}` para el correo de contacto).
 *  - Si el manifest no trae el dato, se deja el texto estático del HTML. */
export function initSiteContent() {
  document.querySelectorAll("[data-site]").forEach((element) => {
    const path = element.dataset.site || "";
    const value = siteValue(path);
    if (!value) return; // sin dato en el manifest: manda el HTML estático

    const template = element.dataset.siteTemplate || "{value}";
    const resolved = template.replaceAll("{value}", value);
    const attribute = element.dataset.siteAttr || (element.tagName === "META" ? "content" : null);

    if (attribute) {
      if (element.getAttribute(attribute) !== resolved) element.setAttribute(attribute, resolved);
      return;
    }
    if (element.children.length > 0) {
      // El marcador tiene dentro un glifo o un SVG (p. ej. las pills de
      // redes): sobrescribirlo lo borraría. El texto repetido se marca en su
      // propio <span> y `npm run check-links` avisa si esto llega a pasar.
      console.warn(
        `[site] data-site="${path}" está en un elemento con hijos; envuelve solo el texto en un <span data-site="${path}">.`
      );
      return;
    }
    /* Solo se reescribe el texto, nunca el subárbol: las pills de redes
       llevan dentro un glifo o un SVG decorativo que hay que conservar. */
    if (element.textContent.replace(/\s+/g, " ").trim() !== resolved) {
      element.textContent = resolved;
    }
  });
}
