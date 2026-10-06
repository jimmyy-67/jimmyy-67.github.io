# Checklist manual de accesibilidad (NVDA / VoiceOver)

Las pruebas automatizadas (Playwright + axe-core, Pa11y) cubren una parte
grande de WCAG 2 A/AA, pero los lectores de pantalla reales tienen
comportamientos que ninguna herramienta reproduce. Esta lista es el repaso
manual recomendado antes de publicar cambios grandes de interfaz; las suites
automatizadas fijan el contrato (roles, nombres, estados, regiones live) del
que estos pasos dependen.

## Preparación

| Lector    | Sistema   | Cómo arrancarlo                                                       |
| --------- | --------- | --------------------------------------------------------------------- |
| NVDA      | Windows   | Instalar desde <https://www.nvaccess.org>; arrancar con `Ctrl+Alt+N`. |
| VoiceOver | macOS/iOS | `Cmd+F5` (o triple clic del botón lateral en iPhone).                 |
| Narrador  | Windows   | `Win+Ctrl+Enter` (alternativa si no hay NVDA).                        |

Consejos: usa un navegador actual (Chromium o Firefox con NVDA; Safari con
VoiceOver), activa el resaltado visual de VO (`Cmd+F5` dos veces rápido no;
es `VO` = `Ctrl+Opción`) y ten a mano la lista de elementos (`NVDA+F7`,
`VO+U` en Safari).

## 1. Carga inicial

- [ ] El lector anuncia el título de la página ("Jimmy - Portfolio").
- [ ] El idioma declarado (`lang="en"`) hace que la voz sea la correcta.
- [ ] Sin anuncios de imágenes decorativas (logo, iconos de pestañas): se
      marcan con `alt=""` / `aria-hidden`.
- [ ] Las imágenes de la galería anuncian su texto alternativo descriptivo.

## 2. Navegación por vistas (`#portfolio` … `#contact`)

- [ ] La lista de enlaces del lector (NVDA+F7 / VO+U) muestra los cinco:
      Portfolio, Projects, Mods, About, Contact.
- [ ] El enlace de la vista actual se anuncia como "current page"
      (`aria-current="page"`).
- [ ] Al activar un enlace, el foco y el anuncio pasan a la nueva vista; no
      queda "anclado" a la vista anterior.
- [ ] El estado de las estadísticas ("Refreshing Nexus Mods statistics…" →
      "Last updated: …") se anuncia al terminar, sin cortar la lectura
      (regiones `role="status"` / `aria-live="polite"`).

## 3. Galería y pestañas

- [ ] Las pestañas se anuncian como "tab" dentro de una lista de pestañas
      ("Gallery categories"), con su estado seleccionado/no seleccionado.
- [ ] Al cambiar de pestaña, el panel se anuncia y el recuento de elementos
      es coherente.
- [ ] Las tarjetas se anuncian como botones con su nombre (título del medio),
      no como " clickable" sin nombre.
- [ ] Con foco en una tarjeta, Enter y Espacio abren el lightbox.

## 4. Lightbox

- [ ] Al abrirse, el lector anuncia "dialog" y el foco entra en el botón de
      cierre.
- [ ] El anuncio incluye título y posición ("Image 3 of 25").
- [ ] Tab no sale del diálogo (foco atrapado) y Escape lo cierra devolviendo
      el foco a la tarjeta que lo abrió.
- [ ] El cambio de imagen con flechas se anuncia (región live del medio).

## 5. Menú móvil (viewport ≤ 700 px)

- [ ] El botón hamburguesa se anuncia como "Main menu, menu button, collapsed"
      (y "expanded" al abrirlo).
- [ ] Al elegir una sección, el menú se cierra y el foco sigue al lector de
      pantalla.
- [ ] Escape cierra el menú y devuelve el foco al botón.

## 6. Contacto

- [ ] El botón de Discord se anuncia como botón con el usuario ("jimy1_").
- [ ] Tras activarlo, se anuncia "Discord username copied to clipboard."
      (región live); no es necesario buscar el mensaje.
- [ ] Los enlaces de plataformas anuncian su destino (Nexus Mods, itch.io,
      GitHub, Discord, Website).

## 7. Degradaciones

- [ ] Con JavaScript deshabilitado: el aviso "JavaScript is disabled." es
      audible, y la navegación estática lleva a cada sección.
- [ ] Si una imagen de galería no carga, el anuncio sigue siendo útil (se
      muestra el placeholder local y el texto alternativo se conserva).
- [ ] Con una imagen de vídeo, el estado "This media could not be loaded."
      es audible si el clip falla.

## Registro

Anota resultado, fecha, lector y navegador de cada repaso (por ejemplo, en el
pull request). Si algo falla, comprueba primero si la suite automatizada
debería haberlo cubierto (`npm run test:e2e`); si es así, añade el caso que
falte antes de arreglarlo.
