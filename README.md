# Jimmy - Portfolio

Portfolio de Jimmy (jimmyy-67), indie dev en Unity 6 y modder de Subnautica (qopp en Nexus Mods). Reúne Refished, su wiki y Discord, mods Hoverfish Hats y SNHardcorePlus, y galería de capturas.

## Estándar de archivos

Separación de responsabilidades: el HTML no lleva CSS ni JS embebidos.

| Archivo       | Rol                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`  | Solo marcado y metadatos SEO. Única excepción inline: el bloque `<script type="application/ld+json">` (JSON-LD), que es dato estructurado para buscadores, no código. |
| `styles.css`  | Todo el estilo del sitio.                                                                                                                                             |
| `script.js`   | Todo el comportamiento (galerías, lightbox, carga diferida, medios responsivos, navegación, fallback de imágenes vía `data-fallback`). Módulo ES (`type="module"`).   |
| `manifest.js` | Contenido editable (galería, media, metadatos). Módulo ES: lo importan `script.js` en el navegador y los scripts de Node (stats, integridad, medios).                 |
| `stats.json`  | Cifras de Nexus Mods refrescadas por el workflow `nexus-stats.yml`.                                                                                                   |

## Calidad y formato del código

Instala las dependencias con `npm ci` (Node.js 20.19 o posterior) y usa estos comandos:

| Comando                         | Comprobación                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`                  | Ejecuta HTMLHint, ESLint y Stylelint.                                                                              |
| `npm run lint:html`             | Valida `index.html` con las reglas de `.htmlhintrc`.                                                               |
| `npm run lint:js`               | Detecta errores de sintaxis, referencias no definidas y variables sin usar mediante ESLint.                        |
| `npm run lint:css`              | Detecta, entre otros problemas, bloques vacíos, selectores duplicados y propiedades duplicadas mediante Stylelint. |
| `npm run format`                | Formatea HTML, CSS, JavaScript, JSON, Markdown y YAML con Prettier.                                                |
| `npm run format:check`          | Comprueba el formato sin modificar archivos.                                                                       |
| `npm run check`                 | Ejecuta todos los linters, comprueba el formato, valida los enlaces locales y el presupuesto de medios.            |
| `npm run check:media`           | Presupuesto de peso de medios y convenciones responsive (variantes, posters, `width`).                             |
| `npm run optimize:media`        | Genera las variantes que falten (imágenes responsive, AVIF, posters, vídeos móviles).                              |
| `npm run optimize:media:videos` | Además, re-comprime los `.mp4` completos con pérdida (H.264 CRF 24/23 + faststart).                                |

El workflow `.github/workflows/code-quality.yml` ejecuta `npm run check` en cada _push_ y _pull request_.

### Comprobación de integridad

El comprobador funciona con Node.js y puede ejecutarse con o sin comprobaciones de red:

```bash
npm run check-links        # assets, metadatos, anclas y enlaces externos
npm run check-links:local  # la misma validación, pero sin realizar peticiones de red
```

`scripts/check-links.mjs` valida todas las imágenes, vídeos, iconos y miniaturas de `manifest.js`; los recursos locales de HTML/CSS; `og:image`, Twitter Cards y favicon; las anclas reales y las rutas `#` del portfolio; y los enlaces HTTP(S) externos. Devuelve un código de salida distinto de cero si encuentra un recurso o enlace roto, de modo que puede utilizarse en CI.

El workflow `site-integrity.yml` ejecuta la parte local en cada pull request. La comprobación externa se ejecuta al publicar en `main`, semanalmente y bajo demanda para evitar que una caída puntual de terceros vuelva inestables los pull requests.

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
- **Módulos ES**: `manifest.js` y `script.js` son módulos (`type="module"`), lo que elimina los globales `window.*`, carga el código con semántica `defer` y deja lista la división en más módulos o `import()` dinámico si el JS crece. Hoy el JS completo pesa ~34 KB (~10 KB gzip), así que partirlo en más archivos solo añadiría peticiones.
- **Minificación**: GitHub Pages ya sirve gzip para HTML/CSS/JS (~57 KB en bruto ≈ 15 KB transferidos). Minificar ahorraría ~5 KB por visita; no compensa un build step ahora. Si el JS/CSS supera ~100 KB, añadir un paso de minificado (p. ej. esbuild) en el deploy es trivial.

**Cache-busting:** los archivos referenciados desde `index.html` llevan `?v=N`
(`styles.css?v=4`, `script.js?v=3`). `script.js` importa `./manifest.js` sin
query: GitHub Pages cachea 10 minutos como máximo, así que tras publicar un
cambio de contenido los visitantes pueden ver el manifest anterior durante
ese lapso (los campos nuevos son opcionales y no rompen nada). Al modificar el
contenido de un archivo referenciado, sube su número de versión.
