# Jimmy - Portfolio

Portfolio de Jimmy (jimmyy-67), indie dev en Unity 6 y modder de Subnautica (qopp en Nexus Mods). Reúne Refished, su wiki y Discord, mods Hoverfish Hats y SNHardcorePlus, y galería de capturas.

## Estándar de archivos

Separación de responsabilidades: el HTML no lleva CSS ni JS embebidos.

| Archivo       | Rol                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`  | Solo marcado y metadatos SEO. Única excepción inline: el bloque `<script type="application/ld+json">` (JSON-LD), que es dato estructurado para buscadores, no código. |
| `styles.css`  | Todo el estilo del sitio.                                                                                                                                             |
| `script.js`   | Todo el comportamiento (galerías, lightbox, lazy-load, navegación, fallback de imágenes vía `data-fallback`).                                                         |
| `manifest.js` | Contenido editable (galería, media, metadatos); lo lee también `scripts/fetch-nexus-stats.mjs`.                                                                       |
| `stats.json`  | Cifras de Nexus Mods refrescadas por el workflow `nexus-stats.yml`.                                                                                                   |

## Calidad y formato del código

Instala las dependencias con `npm ci` (Node.js 20.19 o posterior) y usa estos comandos:

| Comando                | Comprobación                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`         | Ejecuta HTMLHint, ESLint y Stylelint.                                                                              |
| `npm run lint:html`    | Valida `index.html` con las reglas de `.htmlhintrc`.                                                               |
| `npm run lint:js`      | Detecta errores de sintaxis, referencias no definidas y variables sin usar mediante ESLint.                        |
| `npm run lint:css`     | Detecta, entre otros problemas, bloques vacíos, selectores duplicados y propiedades duplicadas mediante Stylelint. |
| `npm run format`       | Formatea HTML, CSS, JavaScript, JSON, Markdown y YAML con Prettier.                                                |
| `npm run format:check` | Comprueba el formato sin modificar archivos.                                                                       |
| `npm run check`        | Ejecuta todos los linters, comprueba el formato y valida los enlaces locales.                                      |

El workflow `.github/workflows/code-quality.yml` ejecuta `npm run check` en cada _push_ y _pull request_.

### Comprobación de integridad

Ejecuta `npm run check-links` para comprobar que las imágenes, vídeos y miniaturas de `manifest.js` existen, que Open Graph/Twitter y el favicon apuntan a archivos válidos, y que no hay anclas ni enlaces externos rotos. Para una comprobación offline usa `npm run check-links -- --skip-external`.

**Cache-busting:** los archivos referenciados desde `index.html` llevan `?v=N`
(`manifest.js?v=41`, `styles.css?v=3`, `script.js?v=2`). Al modificar el
contenido de uno de ellos, sube su número de versión para que los visitantes
recurrentes no sirvan una copia obsoleta de caché.
