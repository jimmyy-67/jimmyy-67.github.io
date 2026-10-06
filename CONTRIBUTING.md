# Guía para contribuidores

Cómo añadir contenido (proyectos, mods, galería), cómo mantener la separación
entre datos y comportamiento, cómo regenerar las miniaturas y cómo convivir con
los workflows que escriben en el repositorio.

Antes de empezar:

```bash
npm ci            # dependencias (Node 20.19 o superior)
npm run check     # linters + formato + manifest + enlaces + medios + versiones
```

`npm run check` es exactamente lo que ejecuta la CI en cada _push_ y _pull
request_. Si pasa en local, pasa en GitHub.

## 1. Reglas del repositorio

| Regla                                      | Detalle                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Datos en `manifest.js`**                 | Todo el contenido editable (proyectos, mods, galería, contacto, redes). Los módulos de `js/` solo lo pintan.                                          |
| **Comportamiento en `js/`**                | Módulos ES con entrada única `js/main.js`. Sin globales de código: `manifest.js` publica datos en `window.*`.                                         |
| **Nada de CSS/JS inline**                  | Ni `style="..."`, ni `<script>` con código, ni `onerror="..."`. El linter HTML falla si reaparecen.                                                   |
| **Nada de `innerHTML`**                    | El DOM se construye con `createElement`, `textContent` y `append`.                                                                                    |
| **Texto alternativo obligatorio**          | Toda imagen de contenido lleva `alt` / `thumbnailAlt` describiendo lo que se ve (no el título ni el nombre del archivo). Es un error que rompe la CI. |
| **Inglés en el sitio, español en el repo** | El contenido visible y los textos de interfaz van en inglés (`<html lang="en">`); la documentación y los comentarios, en español.                     |

## 2. Añadir o modificar entradas en `manifest.js`

`manifest.js` es un IIFE que escribe en `window` (navegador) o en `globalThis`
(Node). Lo leen a la vez el sitio y los scripts de `scripts/`, así que **un
cambio aquí vale para los dos**. Nunca dupliques su contenido en `js/` ni en
`index.html`: si un dato aparece en dos sitios, va en `manifest.js` (ver §3).

### Proyectos (`WORKS`)

| Campo               | Obligatorio        | Qué es                                                                      |
| ------------------- | ------------------ | --------------------------------------------------------------------------- |
| `title`             | sí                 | Nombre visible.                                                             |
| `kind`              | sí                 | Etiqueta corta: `Game`, `Utility app`, `Community docs`…                    |
| `description`       | sí                 | Una o dos frases. Se muestra en el panel del proyecto.                      |
| `url`               | sí                 | Destino del botón principal (http/https).                                   |
| `linkLabel`         | no                 | Texto del botón; si falta se usa `SITE.labels.actions.viewProject`.         |
| `thumbnail`         | no                 | Imagen de la tarjeta (`.webp`). Sin ella se usa `icon`.                     |
| `thumbnailFallback` | no                 | PNG de respaldo para navegadores sin WebP/AVIF.                             |
| `thumbnailAlt`      | si hay `thumbnail` | Descripción de la imagen (mínimo 20 caracteres, que no repita el título).   |
| `width`             | no                 | Ancho real en píxeles del archivo completo: alimenta el `srcset`.           |
| `thumbAspect`       | no                 | `"1280 / 720"`: reserva la proporción y evita el salto de layout.           |
| `icon`              | no                 | SVG para proyectos sin captura (wiki, Discord…). Se renderiza con `alt=""`. |
| `status`            | no                 | Estado visible (`Released`, `Active development`…).                         |
| `tags`              | no                 | Lista de tecnologías.                                                       |

```js
{
  title: "AquaRings",
  kind: "Physics toy",
  description: "A water basketball toy made in Godot 4.7…",
  url: "https://github.com/jimmyy-67/AquaRings",
  linkLabel: "View source",
  thumbnail: "img/aquarings-main.webp",
  thumbnailFallback: "img/aquarings-main.png",
  thumbnailAlt: "AquaRings water tank with nine mini basketballs floating…",
  thumbAspect: "1280 / 720",
  width: 1280,
  status: "Released",
  tags: ["Godot 4.7", "GDScript", "2D Physics"]
}
```

### Mods (`MODS`)

Igual que los proyectos, con tres particularidades:

- **`url` es la fuente de verdad**: tiene que ser una ficha de Nexus
  (`…/mods/<id>`). El script de estadísticas saca de ahí el juego y el ID, así
  que no hay que duplicarlos.
- **`game`** es obligatorio (sale en la etiqueta `Mod · <game>`).
- **`stats`** son cifras de respaldo que solo se usan si `stats.json` no está
  disponible. No las inventes: cópialas de `stats.json` (ver §6).
- **`hidden: true`** oculta la tarjeta sin borrar el mod (útil mientras se
  aclaran permisos) y lo excluye del contador de la sección About.

`repo` es opcional y añade el botón «Source».

### Galería (`GALLERY`)

Objeto `{ categoría: [elementos] }`. Las categorías son un conjunto cerrado:
`unity`, `godot` y `environments` (se valida; una categoría nueva hay que
añadirla antes a `KNOWN_GALLERY_CATEGORIES` en `scripts/validate-manifest.mjs` y
a las pestañas del HTML).

- **Imagen**: `file` (si no empieza por `img/`, `videos/` o `http`, se resuelve
  como `img/portfolio/<file>`), `width`, `alt`, `title`, `description` y, si
  aplica, `fileFallback`.
- **Vídeo**: `file` apuntando a `videos/<nombre>.mp4` y `poster` con su
  miniatura. **Sin `alt`**: los vídeos se describen con `title` +
  `description`, y el validador avisa si se lo pones.

### Validar

```bash
npm run validate-manifest:local   # forma, archivos y textos alternativos (sin red)
npm run validate-manifest         # además comprueba que las URLs responden
```

## 3. Contenido compartido: `SITE` y `data-site`

Los datos que aparecen en **varias secciones** —identidad del sitio, contacto,
redes sociales y mensajes de estado— viven una sola vez, en `SITE`
(`manifest.js`):

```js
root.SITE = {
  name: "Jimmy - Portfolio",
  author: "Jimmy",
  handle: "jimmyy-67",
  url: SITE_URL,
  description: "…",   // <meta name="description"> y JSON-LD
  tagline: "…",       // Open Graph y Twitter
  contact: { email, discordUsername, discordInvite },
  socials: [{ key: "github", label: "GitHub", url: GITHUB_URL }, …],
  labels: { actions: {…}, gallery: {…}, stats: {…} }   // textos de interfaz
};
```

Además, las constantes del IIFE (`NEXUS_PROFILE`, `DISCORD_INVITE`,
`DISCORD_MEMBERS`, `WIKI_URL`…) se reutilizan dentro del propio manifest para
que Projects, Contact y los metadatos nunca se contradigan.

Cómo funciona:

1. `index.html` **marca** con `data-site="ruta"` los elementos que muestran un
   dato compartido, y conserva el valor escrito a mano (es el respaldo sin
   JavaScript y lo que leen los crawlers).

   ```html
   <meta property="og:title" data-site="name" content="Jimmy - Portfolio" />
   <a class="social-pill" data-site="socials.github.url" data-site-attr="href" href="…">
     <span class="pill-glyph glyph-github" aria-hidden="true"></span>
     <span data-site="socials.github.label">GitHub</span>
   </a>
   ```

   - `data-site-attr="href"` escribe en un atributo (en `<meta>` ya se usa
     `content` por defecto).
   - `data-site-template="mailto:{value}"` envuelve el valor.
   - El marcador se pone **en el `<span>` que envuelve solo el texto**: si
     envolviera un icono, sobrescribirlo lo borraría.

2. `js/site.js` **hidrata** esos elementos al arrancar desde `window.SITE`;
   `js/contact.js`, `js/mods.js`, `js/stats.js`… leen de ahí sus textos con
   `siteValue()` / `siteLabel()`.

3. `npm run check-links` **comprueba la coherencia**: falla si un `data-site`
   no existe en `SITE`, si el HTML estático dice algo distinto del manifest, o
   si una URL de redes/contacto del manifest no aparece en `index.html`.

Para cambiar un dato compartido: edítalo en `manifest.js`, actualiza el texto
estático de `index.html` si lo hay y ejecuta `npm run check-links:local`. Si te
dejas el HTML sin tocar, la CI te lo dice con el valor esperado.

## 4. Miniaturas y medios

### Dónde va cada archivo

| Contenido                    | Ruta                                                      |
| ---------------------------- | --------------------------------------------------------- |
| Capturas de Refished (Unity) | `img/portfolio/<Nombre>.png`                              |
| Proyectos Godot              | `img/<nombre>.png` (o `img/projects/<slug>/<nombre>.png`) |
| Banners de mods              | `img/mods/<slug>.png`                                     |
| Vídeos                       | `videos/<nombre>.mp4`                                     |
| Posters de vídeo             | `img/posters/<nombre>.webp` (lo genera el script)         |

### Generar las variantes

`npm run optimize:media` crea, a partir del PNG fuente, todo lo que espera el
sitio (`sharp` + `ffmpeg` en PATH):

- `<nombre>.webp` (solo si no existe: los publicados no se re-comprimen para no
  encadenar pérdida; usa `--force` si has sustituido el PNG fuente),
- `<nombre>-640.webp` y `<nombre>-1024.webp`,
- las mismas tres en `.avif`,
- el poster de cada vídeo (`img/posters/<nombre>.webp`, fotograma al 30 %) y su
  variante móvil (`videos/<nombre>-mobile.mp4`).

Después declara la imagen en `manifest.js` (`thumbnail` + `thumbnailFallback` +
`thumbnailAlt` + `width` + `thumbAspect`) y valida:

```bash
npm run optimize:media          # genera lo que falte
npm run check:media             # presupuesto de peso y convenciones
```

Presupuesto para archivos **nuevos**: imagen ≤ 300 KB, variante responsive
≤ 150 KB, poster ≤ 80 KB, PNG ≤ 400 KB, vídeo ≤ 15 MB, vídeo móvil ≤ 8 MB,
SVG ≤ 25 KB. Un archivo **existente** no puede crecer sin re-basar a propósito
—y el cambio queda visible en el PR— con:

```bash
npm run check:media -- --update-baseline
```

## 5. Versiones de cache-busting (`?v=N`)

GitHub Pages sirve HTML/CSS/JS con caché larga: si el archivo cambia y su URL
no, el visitante recurrente sigue viendo la copia vieja. Por eso las
referencias de `index.html` llevan `?v=N`:

```html
<link rel="stylesheet" href="styles.css?v=6" />
<script src="manifest.js?v=42"></script>
<script type="module" src="js/main.js?v=4"></script>
```

**Cuándo subir el número**

| Si cambias…                                      | Sube…                       |
| ------------------------------------------------ | --------------------------- |
| `manifest.js`                                    | `manifest.js?v=N`           |
| `styles.css`                                     | `styles.css?v=N`            |
| cualquier módulo de `js/`                        | `js/main.js?v=N` (solo ese) |
| una imagen o un SVG referenciado en `index.html` | el `?v=N` de esa etiqueta   |

Los `import` internos entre módulos de `js/` **no** llevan versión: basta con
subir la de `js/main.js`, que es el único que carga el HTML.

Para no olvidarlo:

```bash
npm run check:versions                       # lista las versiones actuales
node scripts/check-asset-versions.mjs --since main
node scripts/check-asset-versions.mjs --since FETCH_HEAD --strict   # falla en vez de avisar
```

Con `--since <revisión>` compara las versiones con las de esa revisión y avisa
de los archivos que cambiaron sin subir su `?v=N`. La CI lo ejecuta en cada PR
en modo aviso (anotación en el _diff_, no bloquea).

## 6. `stats.json` y su workflow

`stats.json` lo rellena la API de Nexus Mods desde GitHub Actions
(`nexus-stats.yml`, todos los días a las 05:23 UTC y bajo demanda). La web lo
lee al cargar y, si no está disponible, cae a las cifras de respaldo de
`manifest.js`.

### Actualizarlo a mano (si el workflow falla)

1. **Con la API** (recomendado): genera una clave en
   <https://www.nexusmods.com/users/myaccount?tab=api> y corre el mismo script
   que usa la CI:

   ```bash
   NEXUS_API_KEY=xxxx node scripts/fetch-nexus-stats.mjs      # solo escribe si cambia algo
   NEXUS_API_KEY=xxxx node scripts/fetch-nexus-stats.mjs --force   # fuerza la escritura
   ```

2. **A mano**: copia las cifras de la ficha de cada mod. Estructura mínima:

   ```json
   {
     "source": { "mods": "…", "profile": "…" },
     "complete": true,
     "syncedAt": "2026-10-06T12:04:54.045Z",
     "generatedAt": "2026-10-06T12:04:54.045Z",
     "mods": {
       "2972": {
         "id": 2972,
         "game": "subnautica",
         "name": "HoverFish Hat",
         "version": "1.0.3",
         "uniqueDownloads": 604,
         "totalDownloads": 685,
         "endorsements": 0,
         "updatedAt": "2026-02-15T21:51:19.000Z",
         "fetchedAt": "2026-10-06T12:04:53.798Z",
         "url": "https://www.nexusmods.com/subnautica/mods/2972"
       }
     },
     "profile": { "name": "qopp", "uniqueDownloads": 714, "modCount": 2 }
   }
   ```

   - `complete`: `false` si algún mod no se pudo leer.
   - `syncedAt`: **solo avanza cuando todos los mods se leen bien**; la web lo
     usa para avisar si los datos tienen más de 48 h.
   - `generatedAt`: marca de tiempo de la ejecución.
   - La clave de cada mod es su ID en Nexus (sale de la `url` del manifest).
   - Formato: 2 espacios y salto final (`npm run format` lo corrige solo).

3. Si actualizas cifras a mano, **actualiza también el respaldo** de
   `MODS[].stats` en `manifest.js` y las tarjetas estáticas de la sección Mods
   en `index.html`.

### Conflictos con el bot

El workflow solo toca `stats.json`, agrupa sus ejecuciones por rama
(`concurrency`) y, antes de publicar, hace `pull --rebase` con reintento. Aun
así, si el bot publica mientras trabajas:

```bash
git fetch origin main
git rebase origin/main
# si stats.json conflictúa: quédate con los números del bot y sigue
git checkout --ours stats.json
git add stats.json && git rebase --continue
```

En un `git merge` es al revés (`--theirs` es la rama que traes). El criterio es
siempre el mismo: `stats.json` son datos generados, gana la copia más reciente
(la que tenga `syncedAt` más alto).

## 7. Workflows

| Workflow               | Cuándo corre                               | Qué hace                                                 |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------- |
| `code-quality.yml`     | push y PR                                  | `npm run check` + aviso de versiones de cache-busting.   |
| `site-integrity.yml`   | PR (local), push a `main`, semanal, manual | `validate-manifest` y `check-links` (con red en `main`). |
| `nexus-stats.yml`      | diario 05:23 UTC y manual                  | Refresca `stats.json` y lo publica.                      |
| `render-hf-banner.yml` | manual o al tocar sus scripts              | Renderiza el banner de Hoverfish.                        |

`nexus-stats.yml`:

- **Solo hace commit si los datos cambian de verdad.** El script compara el
  contenido ignorando `generatedAt`, `syncedAt` y los `fetchedAt`, y publica
  `changed=true|false`; con `false` el trabajo de commit termina sin tocar
  nada. Si la última escritura tiene más de 7 días, refresca la fecha igualmente
  para que la web no siga avisando de datos antiguos. `--force` (o
  `NEXUS_FORCE_WRITE=true`) fuerza la escritura.
- **Si falla, avisa**: el trabajo `notify` llama al workflow reutilizable
  `notify-failure.yml`, que abre una incidencia (o añade un comentario en la
  que ya esté abierta) y, si el secreto `DISCORD_WEBHOOK_URL` existe, manda un
  mensaje al servidor. `site-integrity.yml` usa el mismo aviso.

Para recibir los avisos en Discord: _Settings → Secrets and variables →
Actions → New repository secret_ → `DISCORD_WEBHOOK_URL` (la URL de un webhook
del canal). Sin el secreto el paso se omite y la incidencia sigue creándose.

## 8. Recetas paso a paso

### Añadir un proyecto

1. Añade la entrada en `WORKS` (`manifest.js`) con los campos de la tabla.
2. Si lleva imagen: coloca el PNG en `img/portfolio/` (o `img/projects/<slug>/`)
   y ejecuta `npm run optimize:media`.
3. Declara `thumbnail`, `thumbnailFallback`, `thumbnailAlt`, `width` y
   `thumbAspect`.
4. Si el archivo es nuevo, re-basa el presupuesto:
   `npm run check:media -- --update-baseline`.
5. `npm run check` y abre el PR.

### Añadir un mod

1. Añade la entrada en `MODS` con la `url` de la ficha de Nexus (de ahí salen el
   juego y el ID), `game`, `description` y, si hay imagen, sus campos de
   miniatura.
2. Ejecuta `npm run optimize:media` y, si el banner es nuevo,
   `npm run check:media -- --update-baseline`.
3. Copia las cifras iniciales de `stats.json` a `MODS[].stats` (respaldo).
4. No toques `stats.json`: el workflow lo regenera al día siguiente (o lánzalo a
   mano desde la pestaña Actions).
5. `npm run check` y abre el PR.

### Añadir una imagen a la galería

1. Copia el PNG en la carpeta de la categoría.
2. `npm run optimize:media` (genera WebP/AVIF y las variantes 640/1024).
3. Añade el elemento en `GALLERY.<categoría>` con `file`, `width`, `alt`
   descriptivo, `title` y `description`.
4. `npm run check:media -- --update-baseline` si el archivo es nuevo, y
   `npm run check`.

### Cambiar un dato repetido (email, Discord, redes…)

1. Cámbialo en `SITE` (o en la constante compartida) dentro de `manifest.js`.
2. Actualiza el mismo texto/URL en `index.html` si aparece escrito.
3. `npm run check-links:local`: si las dos copias no coinciden, te lo dice.

## 9. Checklist antes de abrir el PR

- [ ] `npm run check` pasa en local.
- [ ] El contenido nuevo está en `manifest.js`, no en `js/` ni en `index.html`.
- [ ] Toda imagen nueva lleva `alt` descriptivo y sus variantes generadas.
- [ ] Si tocas CSS/JS/manifest referenciado desde el HTML, subiste su `?v=N`.
- [ ] `stats.json` no se ha editado a mano salvo que el workflow fallara.
