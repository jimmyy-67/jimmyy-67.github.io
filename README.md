# Jimmy - Portfolio

Portfolio de Jimmy (jimmyy-67), indie dev en Unity 6 y modder de Subnautica (qopp en Nexus Mods). Reúne Refished, su wiki y Discord, mods Hoverfish Hats y SNHardcorePlus, y galería de capturas.

## Estándar de archivos

Separación de responsabilidades: el HTML no lleva CSS ni JS embebidos.

| Archivo | Rol |
|---|---|
| `index.html` | Solo marcado y metadatos SEO. Única excepción inline: el bloque `<script type="application/ld+json">` (JSON-LD), que es dato estructurado para buscadores, no código. |
| `styles.css` | Todo el estilo del sitio. |
| `script.js` | Todo el comportamiento (galerías, lightbox, lazy-load, navegación, fallback de imágenes vía `data-fallback`). |
| `manifest.js` | Contenido editable (galería, media, metadatos); lo lee también `scripts/fetch-nexus-stats.mjs`. |
| `stats.json` | Cifras de Nexus Mods refrescadas por el workflow `nexus-stats.yml`. |

**Cache-busting:** los archivos referenciados desde `index.html` llevan `?v=N`
(`manifest.js?v=41`, `styles.css?v=1`, `script.js?v=1`). Al modificar el
contenido de uno de ellos, sube su número de versión para que los visitantes
recurrentes no sirvan una copia obsoleta de caché.
