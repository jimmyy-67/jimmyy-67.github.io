# Jimmy - Portfolio

Portfolio de Jimmy (jimmyy-67), indie dev en Unity 6 y modder de Subnautica (qopp en Nexus Mods). Reúne Refished, su wiki y Discord, mods Hoverfish Hats y SNHardcorePlus, y galería de capturas.

## Estándar de archivos

Separación de responsabilidades: el HTML no lleva CSS ni JS embebidos.

| Archivo       | Rol                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`  | Solo marcado y metadatos SEO. Única excepción inline: el bloque `<script type="application/ld+json">` (JSON-LD), que es dato estructurado para buscadores, no código. |
| `styles.css`  | Todo el estilo del sitio.                                                                                                                                             |
| `script.js`   | Todo el comportamiento (galerías, lightbox, lazy-load, navegación, fallback de imágenes vía `data-fallback`).                                                         |
| `manifest.js` | Contenido editable (galería, media, textos alternativos, metadatos); lo lee también `scripts/fetch-nexus-stats.mjs`.                                                  |
| `stats.json`  | Cifras de Nexus Mods refrescadas por el workflow `nexus-stats.yml`.                                                                                                   |
| `img/social/` | Tarjeta de 1200x630 px (`og-card.jpg`) que usan Open Graph y Twitter Cards.                                                                                           |

## Calidad y formato del código

Instala las dependencias con `npm ci` (Node.js 20.19 o posterior) y usa estos comandos:

| Comando                 | Comprobación                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `npm run lint`          | Ejecuta HTMLHint, ESLint y Biome.                                                           |
| `npm run lint:html`     | Valida `index.html` con las reglas de `.htmlhintrc`.                                        |
| `npm run lint:js`       | Detecta errores de sintaxis, referencias no definidas y variables sin usar mediante ESLint. |
| `npm run lint:css`      | Analiza `styles.css` con el linter CSS de Biome.                                            |
| `npm run format`        | Formatea HTML, CSS, JavaScript, JSON, Markdown y YAML con Prettier.                         |
| `npm run format:check`  | Comprueba el formato sin modificar archivos.                                                |
| `npm run check-content` | Revisa metadatos sociales, textos alternativos, datos estructurados y consistencia.         |
| `npm run check`         | Ejecuta todos los linters, el formato, los enlaces locales y la revisión de contenido.      |

El workflow `.github/workflows/code-quality.yml` ejecuta `npm run check` en cada _push_ y _pull request_.

### Comprobación de integridad

El comprobador funciona con Node.js y puede ejecutarse con o sin comprobaciones de red:

```bash
npm run check-links        # assets, metadatos, anclas y enlaces externos
npm run check-links:local  # la misma validación, pero sin realizar peticiones de red
```

`scripts/check-links.mjs` valida todas las imágenes, vídeos, iconos y miniaturas de `manifest.js`; los recursos locales de HTML/CSS; `og:image`, Twitter Cards y favicon; las anclas reales y las rutas `#` del portfolio; y los enlaces HTTP(S) externos. Devuelve un código de salida distinto de cero si encuentra un recurso o enlace roto, de modo que puede utilizarse en CI.

El workflow `site-integrity.yml` ejecuta la parte local en cada pull request. La comprobación externa se ejecuta al publicar en `main`, semanalmente y bajo demanda para evitar que una caída puntual de terceros vuelva inestables los pull requests.

### Comprobación de contenido

```bash
npm run check-content   # metadatos sociales, alt, JSON-LD y consistencia (sin red)
```

`scripts/check-content.mjs` revisa lo que ven buscadores, redes sociales y lectores de pantalla. Falla si:

- un metadato de Open Graph o Twitter falta, está vacío o usa una URL relativa;
- `og:image` / `twitter:image` no existen, no llegan a 1200x630 px o su `og:image:type`, `og:image:width` y `og:image:height` no coinciden con el archivo real (lee las cabeceras de PNG, JPEG, WebP y GIF, sin dependencias);
- falta `og:image:alt` o `twitter:image:alt`, o describen la imagen con una palabra genérica;
- una imagen del HTML no tiene `alt`, o una entrada de `manifest.js` no trae `alt` / `thumbnailAlt`, repite el título o el nombre del archivo;
- el JSON-LD no declara `WebSite` y `Person`, o su nombre, descripción, URL, imagen o redes sociales no coinciden con la página y con `manifest.js`;
- `sitemap.xml` apunta a un ancla inexistente, le falta la URL canónica o `robots.txt` no la declara;
- las cifras de la sección About no cuadran con `manifest.js`, o el enlace de Nexus no coincide con `NEXUS.profile`.

Avisa (sin romper la build) cuando los respaldos de `manifest.js` se quedan atrás respecto a `stats.json`, cuando aparece texto en español en un documento `lang="en"` o cuando un proyecto con miniatura todavía no tiene bloque `CreativeWork`.

### Metadatos sociales, accesibilidad e idioma

- **Tarjeta social.** `og:image` y `twitter:image` apuntan siempre a URLs absolutas de `img/social/og-card.jpg` (1200x630 px, JPEG: el formato que aceptan Facebook, LinkedIn, X/Twitter, Discord y WhatsApp). Si cambia la captura, se regenera con ImageMagick y se actualizan `og:image:width` / `og:image:height`:

  ```bash
  convert img/portfolio/MainMenu.png -crop 994x559+458+132 +repage \
    -background black -gravity center -extent 1065x559 \
    -filter Lanczos -resize 1200x630! -strip -quality 88 img/social/og-card.jpg
  ```

- **Textos alternativos.** Cada entrada de `GALLERY` lleva `alt` y cada proyecto o mod con miniatura lleva `thumbnailAlt`: describen lo que se ve, no el nombre del archivo ni el título (que ya se muestran aparte). En los clips de vídeo ese texto viaja como `aria-label`. `alt=""` queda reservado a las imágenes puramente decorativas (iconos acompañados de su propio texto, como el logo o las pastillas del _tech stack_).
- **Datos estructurados.** `index.html` publica un único JSON-LD con `@graph`: `WebSite` (nombre, descripción, URL, imagen, idioma), `Person` (perfiles en `sameAs`) y un `CreativeWork` por proyecto y mod, copiado de `manifest.js`. Al editar ese bloque hay que recalcular su hash `sha256` en la `Content-Security-Policy`; `check-links.mjs` imprime el valor correcto cuando no coincide.
- **Idioma.** El contenido publicado y las cadenas que leen los lectores de pantalla van en **inglés**, como declara `<html lang="en">`; los comentarios del código y esta documentación van en **español**. Si algún día se publica texto visible en español, hay que marcar su contenedor con `lang="es"` en lugar de mezclar idiomas dentro del mismo bloque.

**Cache-busting:** los archivos referenciados desde `index.html` llevan `?v=N`
(`manifest.js?v=42`, `styles.css?v=3`, `script.js?v=3`). Al modificar el
contenido de uno de ellos, sube su número de versión para que los visitantes
recurrentes no sirvan una copia obsoleta de caché.
