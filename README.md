# Jimmy - Portfolio

Portfolio de Jimmy (jimmyy-67), indie dev en Unity 6 y modder de Subnautica (qopp en Nexus Mods). Reúne Refished, su wiki y Discord, mods HoverFish Hats y SNHardcorePlus, y galería de capturas.

## Estándar de archivos

Separación de responsabilidades: el HTML no lleva CSS ni JS embebidos.

| Archivo       | Rol                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`  | Solo marcado y metadatos SEO. Única excepción inline: el bloque `<script type="application/ld+json">` (JSON-LD), que es dato estructurado para buscadores, no código. |
| `styles.css`  | Todo el estilo del sitio.                                                                                                                                             |
| `js/`         | Todo el comportamiento, dividido en módulos ES por responsabilidad (ver tabla siguiente). Punto de entrada único: `js/main.js` con `type="module"`.                   |
| `manifest.js` | Contenido editable (galería, media, metadatos); lo leen `js/` y los scripts de Node (stats, integridad, medios). Se valida con `scripts/validate-manifest.mjs`.       |
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

| Comando                         | Comprobación                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run lint`                  | Ejecuta HTMLHint, ESLint y Biome.                                                           |
| `npm run lint:html`             | Valida `index.html` con las reglas de `.htmlhintrc`.                                        |
| `npm run lint:js`               | Detecta errores de sintaxis, referencias no definidas y variables sin usar mediante ESLint. |
| `npm run lint:css`              | Analiza `styles.css` con el linter CSS de Biome.                                            |
| `npm run format`                | Formatea HTML, CSS, JavaScript, JSON, Markdown y YAML con Prettier.                         |
| `npm run format:check`          | Comprueba el formato sin modificar archivos.                                                |
| `npm run check`                 | Linters, formato, validación del manifest, enlaces locales y presupuesto de medios.         |
| `npm run check:media`           | Presupuesto de peso de medios y convenciones responsive (variantes, posters, `width`).      |
| `npm run optimize:media`        | Genera las variantes que falten (imágenes responsive, AVIF, posters, vídeos móviles).       |
| `npm run optimize:media:videos` | Además, re-comprime los `.mp4` completos con pérdida (H.264 CRF 24/23 + faststart).         |

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

`scripts/validate-manifest.mjs` valida los datos de `manifest.js`: que las URLs tengan formato válido y sean accesibles (salvo con `--skip-external`), que las categorías de la galería pertenezcan al conjunto conocido, que los archivos de imagen y vídeo referenciados existan en disco, que títulos y descripciones no estén vacíos, que cada imagen tenga un texto alternativo (`alt` / `thumbnailAlt`): falta un alt o usar el nombre del archivo es un error que rompe la CI, y repetir el título o quedarse en una descripción demasiado corta genera un aviso y que los tipos de media sean de formatos permitidos. Devuelve un código de salida distinto de cero si hay datos incorrectos.

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

## Optimización de medios

### Convenciones (las genera `optimize:media`, las verifica `check:media` en CI)

- **Imágenes de tarjetas**: cada entrada del manifest declara `width` (ancho real) y apunta a un `.webp`. Junto a él existen `<nombre>-640.webp`, `<nombre>-1024.webp` y las gemelas `.avif`. El navegador recibe un `<picture>` AVIF → WebP con `srcset` + `sizes` según el contexto (tarjeta, lightbox, proyecto); el PNG de respaldo (`fileFallback` / `thumbnailFallback`) solo se descarga si el navegador no soporta WebP.
- **Vídeos**: además de `videos/<nombre>.mp4` existen la variante móvil `videos/<nombre>-mobile.mp4` (720p desde 1080p, 540p desde 720p) y el poster `img/posters/<nombre>.webp` (fotograma al 30%, ≤960px). Se sirven con `preload="none"` + `poster`: nada se descarga hasta que el usuario reproduce. La variante móvil se elige con `<source media="(max-width: 700px)">` o, con **Save-Data** activo, en cualquier pantalla.
- **Carga diferida**: cada vista inicializa sus recursos al navegar a ella (los grids de galería se construyen por pestaña, no al abrir la página) y cada medio se construye al entrar en el viewport (`IntersectionObserver` con 300px de margen). Mientras tanto, las imágenes muestran un **skeleton** (`.media-frame`) y el lightbox un **spinner**; `prefers-reduced-motion` desactiva la animación.

### Presupuesto de peso (CI)

`scripts/check-media.mjs` compara cada archivo contra `scripts/media-budget.json` (línea base congelada):

- Un archivo **existente no puede crecer** sin actualizar la línea base a propósito (`npm run check:media -- --update-baseline`): el cambio queda visible y revisable en el PR.
- Un archivo **nuevo** debe entrar en el presupuesto: imagen ≤ 300 KB, variante responsive ≤ 150 KB, poster ≤ 80 KB, PNG ≤ 400 KB, vídeo ≤ 15 MB, vídeo móvil ≤ 8 MB, SVG ≤ 25 KB.
- También verifica que cada imagen tenga sus variantes, que el `width` declarado coincida con el archivo real, y que cada vídeo tenga poster y variante móvil. Si el total supera **150 MB** avisa de que toca plantearse un CDN.

### Evaluación de los vídeos

Re-compresión H.264 (CRF 24 en 1080p, 23 en 720p, preset slow, `+faststart`), verificada por fotograma contra el original (PSNR 43–46 dB, imperceptible en movimiento):

| Vídeo               | Antes        | Después     | Móvil      |
| ------------------- | ------------ | ----------- | ---------- |
| `GreatShowcase.mp4` | 52.3 MB      | 6.1 MB      | 2.0 MB     |
| `RiverShowcase.mp4` | 42.5 MB      | 4.6 MB      | 1.6 MB     |
| `tree-transition`   | 3.8 MB       | 2.1 MB      | 0.6 MB     |
| Resto de clips 720p | 10.2 MB      | 4.0 MB      | 1.6 MB     |
| **Total**           | **108.8 MB** | **16.8 MB** | **5.8 MB** |

**CDN:** con ~35 MB totales (vídeos + imágenes) GitHub Pages sobra (recomienda sitios < 1 GB). El umbral de aviso está en 150 MB; si los showcases crecen, el manifiesto ya acepta URLs absolutas en `file`/`poster` (Cloudflare Stream, Bunny o Backblaze+Bunny son las opciones habituales para vídeo bajo demanda) sin tocar el código.

### Evaluación de formatos y carga

- **AVIF**: adoptado para todas las imágenes de tarjetas. En las capturas con degradados suaves (submarinos de Refished, agua de AquaRings) ahorra un 30–50% frente al WebP existente a calidad visual equivalente (p. ej. `MainMenu`: 123 KB WebP → 87 KB AVIF; `CoralSurvival3`: 624 KB PNG → 53 KB AVIF). WebP queda como respaldo (Safari < 16.4) y PNG como último recurso.
- **Módulos ES**: el comportamiento vive en `js/` dividido por responsabilidad (entrada única `js/main.js`, `type="module"`), con semántica `defer` y sin globales de código. `manifest.js` queda como script clásico (IIFE) que publica los datos en `window.*`: los módulos del navegador y los scripts de Node (stats, validación, medios) lo leen del mismo lugar.
- **Minificación**: GitHub Pages ya sirve gzip para HTML/CSS/JS (~57 KB en bruto ≈ 15 KB transferidos). Minificar ahorraría ~5 KB por visita; no compensa un build step ahora. Si el JS/CSS supera ~100 KB, añadir un paso de minificado (p. ej. esbuild) en el deploy es trivial.

**Cache-busting:** los archivos referenciados desde `index.html` llevan `?v=N`
(`manifest.js?v=42`, `styles.css?v=6`, `js/main.js?v=4`). Al modificar el
contenido de uno de ellos, sube su número de versión para que los visitantes
recurrentes no sirvan una copia obsoleta de caché. Los imports internos entre
módulos de `js/` no llevan versión: basta con subir la de `js/main.js`.

## Resiliencia y funcionamiento degradado

El sitio sigue siendo un documento estático útil cuando un tercero, una red o
JavaScript no están disponibles. Estos son los servicios externos identificados
y su comportamiento de respaldo:

| Servicio              | Uso                                           | Respaldo en el navegador                                                                                                                                                               |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Fonts          | Tipografía Space Grotesk                      | La pila CSS continúa con `ui-sans-serif`, `system-ui`, fuentes del sistema de Apple/Windows y `sans-serif`.                                                                            |
| GitHub / GitHub Pages | Código, enlaces y publicación de `stats.json` | No se consulta una API de GitHub en tiempo de ejecución. Si no puede cargarse `stats.json`, se conservan las cifras estáticas de `manifest.js`/HTML.                                   |
| Nexus Mods            | Enlaces, banners de mods y cifras actuales    | Toda imagen dinámica prueba primero su fallback propio y después `img/media-placeholder.svg` mediante un listener `error`; los números estáticos siguen visibles si falla la petición. |
| itch.io               | Enlace de Refished y posibles miniaturas      | Las miniaturas pasan por el mismo fallback local genérico; el enlace permanece disponible como URL normal.                                                                             |
| Discord               | Invitación de comunidad                       | Si el navegador está sin red o la comprobación de transporte expira/falla, se muestra un aviso visible y amable sin ocultar otras vías de contacto.                                    |
| Fandom                | Wiki de Refished                              | Tiene la misma comprobación y aviso que Discord.                                                                                                                                       |

`js/utils.js` no usa atributos `onerror` inline: registra el evento `error` de
la imagen y evita bucles cuando también falla el fallback. Las tarjetas de
imagen y vídeo, y el lightbox, muestran un spinner mientras descargan; un vídeo
que no se puede leer muestra un mensaje en su lugar.

### Sin JavaScript

`body` empieza con la clase `no-js`. En ese estado cada sección se deja visible,
`<noscript>` explica la versión reducida y ofrece enlaces a Portfolio, Projects,
Mods, About y Contact. La galería tiene muestras locales, Projects conserva una
lista de enlaces y Mods muestra las dos tarjetas con sus cifras guardadas
directamente en HTML. Al arrancar `js/main.js`, cambia la clase a `js-ready`,
oculta estos respaldos y activa el router y los componentes enriquecidos.

### Actualización de estadísticas

`.github/workflows/nexus-stats.yml` refresca `stats.json` **todos los días a
las 05:23 UTC** y permite una ejecución manual. La periodicidad diaria es
suficiente para contadores de descargas de mods y limita el uso de la API de
Nexus. `js/stats.js` muestra un spinner mientras consulta el archivo, la fecha
local de `syncedAt`/`generatedAt` cuando llega y un aviso discreto si el último
refresh tiene más de 48 horas. Si la petición falla o el JSON es inválido, se
muestra el error y se mantienen las cifras estáticas en lugar de fallar en
silencio.

La comprobación completa de HTTP de los destinos externos corre en
`site-integrity.yml` al publicar en `main`, semanalmente y bajo demanda. En un
navegador no es posible leer el código HTTP de Discord/Fandom por CORS; el
aviso inmediato detecta desconexión, fallo de transporte o timeout, mientras la
verificación de CI cubre los códigos de respuesta del servidor.
