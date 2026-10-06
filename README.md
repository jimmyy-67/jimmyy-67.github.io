# Jimmy - Portfolio

Portfolio de Jimmy (jimmyy-67), indie dev en Unity 6 y modder de Subnautica (qopp en Nexus Mods). Reúne Refished, su wiki y Discord, mods HoverFish Hats y SNHardcorePlus, y galería de capturas.

## Estándar de archivos

Separación de responsabilidades: el HTML no lleva CSS ni JS embebidos.

| Archivo       | Rol                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`  | Solo marcado y metadatos SEO. Única excepción inline: el bloque `<script type="application/ld+json">` (JSON-LD), que es dato estructurado para buscadores, no código. |
| `styles.css`  | Todo el estilo del sitio.                                                                                                                                             |
| `js/`         | Todo el comportamiento, dividido en módulos ES por responsabilidad (ver tabla siguiente). Punto de entrada único: `js/main.js` con `type="module"`.                   |
| `manifest.js` | Contenido editable (galería, media, metadatos); lo lee también `scripts/fetch-nexus-stats.mjs`. Se valida con `scripts/validate-manifest.mjs`.                        |
| `stats.json`  | Cifras de Nexus Mods refrescadas por el workflow `nexus-stats.yml`.                                                                                                   |

**Estilos inline prohibidos:** ningún elemento de `index.html` puede llevar el
atributo `style="..."`. Cada estilo debe existir como clase en `styles.css`
(p. ej. `card-text--spaced` en lugar de `style="margin-top: 8px"`, o las
variantes `glyph-*` para los iconos de `tab-glyph`/`pill-glyph`). La regla
`inline-style-disabled` de `.htmlhintrc` hace que `npm run lint:html` (y por
tanto la CI) falle si reaparece un estilo inline.

**Sin `innerHTML`:** el DOM se construye siempre con `textContent`,
`createElement`, `append`/`appendChild` y `replaceChildren`, nunca
interpolando cadenas HTML.

### Módulos de `js/`

| Módulo             | Responsabilidad                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/main.js`       | Punto de entrada único (`type="module"`): importa e inicializa el resto de módulos.                                                                                           |
| `js/gallery.js`    | Renderizado de galerías y filtrado por pestañas.                                                                                                                              |
| `js/lightbox.js`   | Apertura, cierre, navegación y accesibilidad del lightbox.                                                                                                                    |
| `js/projects.js`   | Renderizado de tarjetas de proyectos.                                                                                                                                         |
| `js/mods.js`       | Renderizado de tarjetas de mods y enlaces externos.                                                                                                                           |
| `js/navigation.js` | Menú móvil, scroll suave y estado activo de enlaces (router por hash).                                                                                                        |
| `js/stats.js`      | Carga de estadísticas de Nexus Mods y fallback estático de `manifest.js`.                                                                                                     |
| `js/contact.js`    | Interacciones de la vista de contacto (copiar usuario de Discord).                                                                                                            |
| `js/utils.js`      | Funciones compartidas: observadores de lazy-load (con fallback si falta `IntersectionObserver`), creación de enlaces, helpers DOM y fallback de imágenes vía `data-fallback`. |

## Calidad y formato del código

Instala las dependencias con `npm ci` (Node.js 20.19 o posterior) y usa estos comandos:

| Comando                | Comprobación                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `npm run lint`         | Ejecuta HTMLHint, ESLint y Biome.                                                           |
| `npm run lint:html`    | Valida `index.html` con las reglas de `.htmlhintrc`.                                        |
| `npm run lint:js`      | Detecta errores de sintaxis, referencias no definidas y variables sin usar mediante ESLint. |
| `npm run lint:css`     | Analiza `styles.css` con el linter CSS de Biome.                                            |
| `npm run format`       | Formatea HTML, CSS, JavaScript, JSON, Markdown y YAML con Prettier.                         |
| `npm run format:check` | Comprueba el formato sin modificar archivos.                                                |
| `npm run check`        | Ejecuta todos los linters, comprueba el formato y valida los enlaces locales.               |

El workflow `.github/workflows/code-quality.yml` ejecuta `npm run check` en cada _push_ y _pull request_.

### Comprobación de integridad

El comprobador funciona con Node.js y puede ejecutarse con o sin comprobaciones de red:

```bash
npm run check-links              # assets, metadatos, anclas y enlaces externos
npm run check-links:local        # la misma validación, pero sin realizar peticiones de red
npm run validate-manifest        # datos de manifest.js, incluida la accesibilidad de URLs
npm run validate-manifest:local  # la misma validación, pero sin realizar peticiones de red
```

`scripts/check-links.mjs` valida todas las imágenes, vídeos, iconos y miniaturas de `manifest.js`; los recursos locales de HTML/CSS; `og:image`, Twitter Cards y favicon; las anclas reales y las rutas `#` del portfolio; y los enlaces HTTP(S) externos. Devuelve un código de salida distinto de cero si encuentra un recurso o enlace roto, de modo que puede utilizarse en CI.

`scripts/validate-manifest.mjs` valida los datos de `manifest.js`: que las URLs tengan formato válido y sean accesibles (salvo con `--skip-external`), que las categorías de la galería pertenezcan al conjunto conocido, que los archivos de imagen y vídeo referenciados existan en disco, que títulos y descripciones no estén vacíos, que cada imagen tenga un texto alternativo descriptivo (`alt` / `thumbnailAlt`, que no puede limitarse a repetir el título o el nombre del archivo) y que los tipos de media sean de formatos permitidos. Devuelve un código de salida distinto de cero si hay datos incorrectos.

El workflow `site-integrity.yml` ejecuta la parte local (incluida la validación de `manifest.js`) en cada pull request; además, `npm run check` —que corre `code-quality.yml` en cada _push_— también incluye `validate-manifest:local`, de modo que el build falla si hay datos incorrectos. La comprobación externa se ejecuta al publicar en `main`, semanalmente y bajo demanda para evitar que una caída puntual de terceros vuelva inestables los pull requests.

## SEO, metadatos sociales y accesibilidad

**Open Graph / Twitter.** Todas las URLs de `og:*` y `twitter:*` son absolutas
(`https://jimmyy-67.github.io/...`): los rastreadores no resuelven rutas
relativas. La imagen compartida es `img/portfolio/MainMenu.webp` (1920x1032 px
reales, por encima del mínimo recomendado de 1200x630) y se declara con
`og:image:type`, `og:image:width`, `og:image:height` y `og:image:alt`, más un
segundo `og:image` en PNG para los scrapers que aún no leen WebP.
`twitter:image` apunta a la misma imagen y lleva su `twitter:image:alt`. Si
cambias la imagen, actualiza tipo y dimensiones: `npm run check-links`
comprueba que el archivo exista, pero no que las medidas declaradas coincidan.

**Datos estructurados.** `index.html` incluye un único bloque JSON-LD con un
`@graph` de `WebSite`, `Person` y `CreativeWork` (Refished) enlazados por
`@id`. Al editarlo cambia su hash: `npm run check-links` calcula el `sha256`
correcto y falla indicándolo; cópialo en la CSP de `index.html` y en
`SECURITY.md`. Mantener un solo `<script>` evita gestionar varios hashes.

**Textos alternativos.** Las imágenes de contenido (galería, proyectos y mods)
llevan su descripción en `manifest.js` (`alt` / `thumbnailAlt`) y se validan
con `npm run validate-manifest`. Los iconos que acompañan a un texto visible
—logotipo del encabezado, iconos de la pila técnica, bandera de idioma— se
renderizan con `alt=""` porque son decorativos y repetirlos duplicaría el
anuncio del lector de pantalla.

**Idioma.** El contenido visible del sitio está en inglés, de acuerdo con
`<html lang="en">`; también lo están los textos de interfaz generados por
JavaScript (lightbox, estados de copia, etiquetas ARIA). La documentación del
repositorio y los comentarios del código están en español y no afectan al
idioma declarado. Si algún día se publica contenido visible en español,
márcalo por secciones con `lang="es"` en el contenedor correspondiente en
lugar de cambiar el `lang` del documento.

**Consistencia de contenido.** Títulos, descripciones y estadísticas salen de
`manifest.js`; las cifras reales de Nexus Mods llegan de `stats.json` y los
números de `manifest.js` (y el respaldo estático de la sección About en
`index.html`) deben actualizarse con ellos cuando se tocan a mano. El
`sitemap.xml` solo lista la raíz y las vistas `#` existentes del router.

**Cache-busting:** los archivos referenciados desde `index.html` llevan `?v=N`
(`manifest.js?v=42`, `styles.css?v=4`, `js/main.js?v=2`). Al modificar el
contenido de uno de ellos, sube su número de versión para que los visitantes
recurrentes no sirvan una copia obsoleta de caché. Los imports internos entre
módulos de `js/` no llevan versión: basta con subir la de `js/main.js`.
