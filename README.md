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

### Comprobación de integridad

El comprobador no requiere dependencias externas y funciona con Node.js 18 o posterior:

```bash
npm run check-links        # assets, metadatos, anclas y enlaces externos
npm run check-links:local  # la misma validación, pero sin realizar peticiones de red
```

`scripts/check-links.mjs` valida todas las imágenes, vídeos, iconos y miniaturas de `manifest.js`; los recursos locales de HTML/CSS; `og:image`, Twitter Cards y favicon; las anclas reales y las rutas `#` del portfolio; y los enlaces HTTP(S) externos. Devuelve un código de salida distinto de cero si encuentra un recurso o enlace roto, de modo que puede utilizarse en CI.

El workflow `site-integrity.yml` ejecuta la parte local en cada pull request. La comprobación externa se ejecuta al publicar en `main`, semanalmente y bajo demanda para evitar que una caída puntual de terceros vuelva inestables los pull requests.

**Cache-busting:** los archivos referenciados desde `index.html` llevan `?v=N`
(`manifest.js?v=41`, `styles.css?v=3`, `script.js?v=2`). Al modificar el
contenido de uno de ellos, sube su número de versión para que los visitantes
recurrentes no sirvan una copia obsoleta de caché.
