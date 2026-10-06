# Jimmy - Portfolio

Portfolio de Jimmy (jimmyy-67), indie dev en Unity 6 y modder de Subnautica (qopp en Nexus Mods). Reúne Refished, su wiki y Discord, mods Hoverfish Hats y SNHardcorePlus, y galería de capturas.

## Estándar de archivos

Separación de responsabilidades: el HTML no lleva CSS ni JS embebidos.

| Archivo               | Rol                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`          | Solo marcado y metadatos SEO. Única excepción inline: el bloque `<script type="application/ld+json">` (JSON-LD), que es dato estructurado para buscadores, no código. |
| `styles.css`          | Todo el estilo del sitio.                                                                                                                                             |
| `noscript.css`        | Estilos de la versión sin JavaScript. Solo se descarga desde `<noscript>`.                                                                                            |
| `script.js`           | Todo el comportamiento (galerías, lightbox, lazy-load, navegación, estados de carga y error, fallback de imágenes vía `data-fallback`).                               |
| `manifest.js`         | Contenido editable (galería, media, metadatos); lo lee también `scripts/fetch-nexus-stats.mjs`.                                                                       |
| `stats.json`          | Cifras de Nexus Mods refrescadas por el workflow `nexus-stats.yml`.                                                                                                   |
| `img/placeholder.svg` | Marcador genérico que sustituye a cualquier imagen o clip que no cargue.                                                                                              |

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
npm run check-links        # assets, metadatos, anclas y enlaces externos
npm run check-links:local  # la misma validación, pero sin realizar peticiones de red
```

`scripts/check-links.mjs` valida todas las imágenes, vídeos, iconos y miniaturas de `manifest.js`; los recursos locales de HTML/CSS; `og:image`, Twitter Cards y favicon; las anclas reales y las rutas `#` del portfolio; y los enlaces HTTP(S) externos. Devuelve un código de salida distinto de cero si encuentra un recurso o enlace roto, de modo que puede utilizarse en CI.

El workflow `site-integrity.yml` ejecuta la parte local en cada pull request. La comprobación externa se ejecuta al publicar en `main`, semanalmente y bajo demanda para evitar que una caída puntual de terceros vuelva inestables los pull requests.

**Cache-busting:** los archivos referenciados desde `index.html` llevan `?v=N`
(`manifest.js?v=42`, `styles.css?v=4`, `script.js?v=3`, `noscript.css?v=1`). Al
modificar el contenido de uno de ellos, sube su número de versión para que los
visitantes recurrentes no sirvan una copia obsoleta de caché.

## Resiliencia ante fallos

El sitio es estático y se sirve entero desde GitHub Pages, así que lo único
que puede faltar son servicios de terceros, la red del visitante o el propio
JavaScript. Cada caso tiene un plan B explícito.

### Servicios externos y su respaldo

| Servicio             | Para qué se usa                                       | Qué pasa si falla                                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Fonts**     | Tipografía Space Grotesk (`fonts.googleapis.com`)     | La pila `--font-sans` sigue con Segoe UI, system-ui, Roboto, Noto Sans y la sans-serif del sistema; el texto se lee igual desde el primer pintado (`display=swap`) y los titulares aflojan el interletraje. |
| **GitHub (Actions)** | Regenera `stats.json` a diario                        | La web se queda con el último `stats.json` publicado y avisa de su antigüedad; si tampoco está, usa las cifras estáticas de `manifest.js` e `index.html`.                                                   |
| **GitHub (enlaces)** | Repositorios de cada proyecto y mod                   | Enlace etiquetado con `data-service="github"`: sin conexión no abre una pestaña muerta, se explica el problema y se da la dirección.                                                                        |
| **Nexus Mods**       | Perfil, fichas de mods y origen de las estadísticas   | Las carátulas son copias locales, nunca _hotlinks_; las cifras tienen respaldo estático y los enlaces avisan igual que los de GitHub.                                                                       |
| **itch.io**          | Descarga de Refished                                  | Portada servida en local y enlace con aviso (`data-service="itch"`).                                                                                                                                        |
| **Discord**          | Invitación a la comunidad                             | Aviso con la invitación en texto (`discord.gg/MBr2QaUfBg`) y el correo como vía alternativa; el usuario también está copiable en Contact.                                                                   |
| **Fandom**           | Wiki de Refished                                      | Aviso con la dirección de la wiki (`data-service="fandom"`).                                                                                                                                                |
| **YouTube**          | Miniaturas de proyectos con vídeo (`img.youtube.com`) | Hoy ningún proyecto lo usa; si se añade, la miniatura que no cargue cae en `img/placeholder.svg`.                                                                                                           |

Las imágenes siguen siempre la misma cadena: **original → `data-fallback`
(normalmente el `.png` junto al `.webp`) → `img/placeholder.svg`**. Los iconos
decorativos que fallan se ocultan, porque el texto que acompañan ya los
explica.

Desde el navegador **no se comprueba** si Discord, Fandom o Nexus responden:
la CSP (`connect-src 'self'`) y CORS lo impiden, y sondear dominios de terceros
en cada visita sería una fuga de privacidad. Lo que sí se detecta es que el
visitante se ha quedado sin conexión, que es la causa habitual de que un
enlace "no haga nada". La disponibilidad real de cada destino la vigila
`site-integrity.yml` con `npm run check-links` (al publicar, cada lunes y bajo
demanda).

### Versión sin JavaScript

`script.js` construye la galería, los proyectos, las tarjetas de mods y el
router de vistas; sin él la página se quedaría en blanco, porque `.view` solo
se muestra cuando el router marca la vista activa. Por eso `index.html`
incluye bloques `<noscript>` con:

- un aviso de que JavaScript está desactivado, con enlaces estáticos a
  `#view-portfolio`, `#view-projects`, `#view-mods`, `#view-about` y
  `#view-contact`;
- la galería completa en HTML (capturas como `<img>` y clips como `<video
controls preload="none">`, que no descargan nada hasta que se pulsa play);
- la lista de proyectos y de mods con sus descripciones y enlaces;
- `noscript.css`, que muestra todas las vistas seguidas, oculta los controles
  que solo funcionan con script y devuelve el menú móvil a una fila.

About y Contact ya eran HTML estático, incluidas las cifras de respaldo. Los
destinos del menú (`#portfolio`, `#projects`...) son además anclas reales
dentro de cada vista, así que la navegación sigue llevando a su sección.

Para revisar esta versión: _DevTools → Command palette → Disable JavaScript_.

### Estadísticas y estados de red

- `nexus-stats.yml` refresca `stats.json` **una vez al día** (05:23 UTC) y
  también al tocar `manifest.js` o el script de recogida. Las cifras de Nexus
  se mueven despacio y la cuota de la API es limitada, así que más frecuencia
  no aportaría nada.
- `syncedAt` solo avanza cuando **todos** los mods se han leído bien, de modo
  que una sincronización parcial no se presenta como actualizada.
- La web enseña siempre cuándo se sincronizó (`Nexus Mods figures updated 3
hours ago`), con la fecha exacta en el `title`, y a partir de
  **7 días** cambia a un aviso discreto en ámbar.
- Mientras se consulta `stats.json` hay esqueleto y _spinner_; si la petición
  falla (o tarda más de 10 s) aparece un mensaje visible con botón **Retry**,
  nunca un fallo silencioso. Las cifras de respaldo siguen a la vista y el
  `title` aclara que son el último dato guardado.
- Imágenes y vídeos anuncian su estado en `data-state` (`loading`, `ready`,
  `error`): esqueleto animado mientras descargan y marcador genérico si no
  llegan. El visor a pantalla completa muestra _spinner_ y, si el archivo no
  carga, un mensaje en lugar de un hueco negro.
- Al perder la conexión aparece un aviso fijo que se retira solo al
  recuperarla, momento en el que además se reintentan las cifras en vivo.
