/* ============================================================================
 * manifest.js - contenido editable del portfolio
 *
 * Se publica tal cual en el navegador y, además, lo leen los scripts de Node
 * (`fetch-nexus-stats.mjs`, `check-links.mjs`, `validate-manifest.mjs`,
 * `check-media.mjs`, `optimize-media.mjs`). Por eso todo va dentro de un
 * IIFE que escribe en `window` (navegador) o en `globalThis` (Node): una
 * sola fuente de verdad.
 *
 * Los números de `stats` son solo un respaldo: si existe `stats.json`, la web
 * muestra los datos reales de la API y estos quedan ignorados.
 *
 * Textos alternativos: toda imagen de contenido lleva su descripción aquí
 * (`alt` en la galería, `thumbnailAlt` en proyectos y mods). Debe explicar
 * qué se ve, no repetir el título ni el nombre del archivo; los vídeos no lo
 * usan porque se describen con `title` + `description`. Los iconos
 * decorativos (`icon`) se renderizan con alt vacío a propósito.
 *
 * Convenciones de medios (las genera `npm run optimize:media` y las verifica
 * `npm run check:media` en CI):
 *   - Imágenes de tarjetas: además de `<nombre>.webp` existen las variantes
 *     responsive `<nombre>-640.webp`, `<nombre>-1024.webp` y sus gemelas
 *     `.avif`. `width` es el ancho real en píxeles del archivo completo (lo
 *     usa el srcset) y `fileFallback`/`thumbnailFallback` el PNG de respaldo
 *     para navegadores sin WebP/AVIF.
 *   - Vídeos locales: además de `videos/<nombre>.mp4` existen la variante
 *     móvil `videos/<nombre>-mobile.mp4` (≤700px de viewport o Save-Data) y
 *     el poster `img/posters/<nombre>.webp` declarado en `poster`.
 *   - `thumbAspect` fija desde el principio la proporción del marco y evita
 *     el salto de layout mientras carga la imagen.
 *
 * Separación contenido / comportamiento: aquí vive TODO el contenido
 * editable, incluidos los datos que se repiten en varias secciones. Los
 * módulos de `js/` solo leen estos datos y los pintan; ningún módulo
 * escribe textos, enlaces de contacto o redes sociales por su cuenta.
 *   - `SITE`: identidad (nombre, descripciones, URL), contacto y redes.
 *     `index.html` marca con `data-site="ruta.del.valor"` los elementos que
 *     los muestran; `js/site.js` los hidrata y `npm run check-links`
 *     comprueba que el HTML estático (respaldo sin JavaScript) siga
 *     coincidiendo con lo de aquí.
 *   - `SITE.labels`: textos de interfaz que usan varios módulos (`js/`).
 *   - Constantes compartidas del IIFE (`DISCORD_INVITE`, `NEXUS_PROFILE`,
 *     `WIKI_URL`...): un dato que aparece en dos secciones se escribe una
 *     sola vez y se reutiliza.
 * ==========================================================================*/
(function (root) {
  /* ===== Constantes compartidas =====
   * Todo lo que se muestra en más de un sitio se declara una sola vez aquí.
   * Cambiar el valor lo cambia en todas las secciones a la vez: es la
   * garantía de que Projects, Contact, el pie de Mods y los metadatos de
   * `index.html` nunca se contradigan. */
  const NEXUS_PROFILE = "qopp";
  const NEXUS_PROFILE_URL = `https://www.nexusmods.com/profile/${NEXUS_PROFILE}/mods`;
  const DISCORD_INVITE = "https://discord.gg/MBr2QaUfBg";
  const DISCORD_MEMBERS = "600+";
  const WIKI_URL = "https://feed-and-grow-refished.fandom.com/wiki/Main_Page";
  const GITHUB_URL = "https://github.com/jimmyy-67";
  const ITCH_URL = "https://j1mmyy.itch.io/";
  const SITE_URL = "https://jimmyy-67.github.io/";

  /* ===== Identidad, contacto y redes =====
   * `js/site.js` hidrata con esto los elementos marcados con `data-site`
   * en `index.html` (título, metadatos, tarjetas de contacto, pills de
   * redes y enlaces del pie de Mods). `scripts/validate-manifest.mjs`
   * valida la forma y `scripts/check-links.mjs` verifica que el HTML
   * estático —que es lo que ven los crawlers y los navegadores sin
   * JavaScript— sigue diciendo lo mismo que aquí.
   *
   * `labels` son los textos de interfaz que comparten varios módulos:
   * al cambiar uno, cambia en todas las secciones que lo usan. */
  root.SITE = {
    name: "Jimmy - Portfolio",
    author: "Jimmy",
    handle: "jimmyy-67",
    url: SITE_URL,
    language: "en",
    locale: "en_US",
    /* `description` = <meta name="description"> y JSON-LD (buscadores);
       `tagline` = Open Graph y Twitter (más corta, para la tarjeta). */
    description:
      "Portfolio of Jimmy (jimmyy-67): Unity and Godot games, Subnautica mods and community projects, including Refished, Tree?, CalculatorGD and AquaRings.",
    tagline:
      "Game developer and Subnautica modder: Unity and Godot projects, Refished, Tree?, CalculatorGD, AquaRings and more.",
    contact: {
      email: "deeoqe@gmail.com",
      discordUsername: "jimy1_",
      discordInvite: DISCORD_INVITE
    },
    socials: [
      { key: "nexusmods", label: "Nexus Mods", url: NEXUS_PROFILE_URL },
      { key: "itchio", label: "itch.io", url: ITCH_URL },
      { key: "github", label: "GitHub", url: GITHUB_URL },
      { key: "discord", label: `Discord (${DISCORD_MEMBERS})`, url: DISCORD_INVITE },
      { key: "website", label: "Website", url: SITE_URL }
    ],
    labels: {
      actions: {
        viewProject: "View project",
        viewOnNexus: "View on Nexus",
        source: "Source"
      },
      gallery: {
        openMedia: "Open media",
        clip: "Clip"
      },
      stats: {
        uniqueDownloads: "unique downloads",
        profileDownloads: "unique downloads from my mods",
        /* Mensajes del renglón de estado de estadísticas: los mismos en las
           vistas Mods y About, tanto en el HTML estático como en `stats.js`. */
        status: {
          loading: "Refreshing Nexus Mods statistics…",
          updated: "Last updated:",
          stale: "Statistics may be out of date. Last updated:",
          noDate: "Statistics were loaded, but their update date is unavailable.",
          error: "Statistics could not be refreshed. Showing saved fallback figures."
        }
      }
    }
  };

  /* ===== Works / Projects ===== */
  root.WORKS = [
    {
      title: "Refished",
      kind: "Game",
      description:
        "Free unofficial fan remake of FAG:F. Solo developed in Unity 6, with updates whose timing varies by update size.",
      url: "https://j1mmyy.itch.io/refished",
      linkLabel: "Play on itch.io",
      thumbnail: "img/portfolio/baby-turtle.webp",
      thumbnailFallback: "img/portfolio/baby-turtle.png",
      thumbnailAlt:
        "A group of baby sea turtles swimming over a sunlit orange sand slope in Refished.",
      thumbAspect: "1983 / 793",
      width: 1983,
      status: "Active development",
      tags: ["Unity 6", "C#", "Solo dev"]
    },
    {
      title: "Tree?",
      kind: "Creative coding",
      description:
        "A procedural pine tree rendered as vector assets inside a retro terminal frame, with ten switchable wind animations. Everything on screen is generated from code.",
      url: "https://github.com/jimmyy-67/Tree",
      linkLabel: "View source",
      thumbnail: "img/portfolio/TerminalPine.webp",
      thumbnailFallback: "img/portfolio/TerminalPine.png",
      thumbnailAlt:
        "Retro terminal window labelled Pine 1a with a bright green procedural pine tree and grass drawn over a black background, plus the wind meter and keyboard shortcuts.",
      thumbAspect: "1280 / 550",
      width: 1280,
      status: "New",
      tags: ["Godot 4.7", "GDScript", "Procedural animation"]
    },
    {
      title: "CalculatorGD",
      kind: "Utility app",
      description:
        "A small hand-drawn calculator made with Godot 4.7. It supports keyboard input, basic operations and hidden jokes for special results.",
      url: "https://github.com/jimmyy-67/CalculatorGD",
      linkLabel: "View source",
      thumbnail: "img/projects/calculator/screenshot.webp",
      thumbnailFallback: "img/projects/calculator/screenshot.png",
      thumbnailAlt:
        "Hand-drawn Godot calculator app showing the operation 1234x56 above the result 69104.",
      thumbAspect: "1280 / 720",
      width: 1280,
      status: "Released",
      tags: ["Godot 4.7", "GDScript", "UI / UX"]
    },
    {
      title: "AquaRings",
      kind: "Physics toy",
      description:
        "A water basketball toy made in Godot 4.7. Nine mini balls drift inside a tank while two pumps fire water jets that move every ball at once.",
      url: "https://github.com/jimmyy-67/AquaRings",
      linkLabel: "View source",
      thumbnail: "img/aquarings-main.webp",
      thumbnailFallback: "img/aquarings-main.png",
      thumbnailAlt:
        "AquaRings water tank with nine mini basketballs floating in blue water beneath a white ceiling hoop, and the two pump buttons A and D on the green base.",
      thumbAspect: "1280 / 720",
      width: 1280,
      status: "Released",
      tags: ["Godot 4.7", "GDScript", "2D Physics"]
    },
    {
      title: "Refished Wiki",
      kind: "Community docs",
      description: "Community wiki with full documentation of fish species, maps and mechanics.",
      url: WIKI_URL,
      linkLabel: "Visit wiki",
      icon: "img/fandom.svg",
      status: "Live",
      tags: ["Fandom", "Community docs"]
    },
    {
      title: "Discord Server",
      kind: "Community",
      description: `${DISCORD_MEMBERS} members. An active community for feedback, beta testing and development updates.`,
      url: DISCORD_INVITE,
      linkLabel: "Join server",
      icon: "img/discord.svg",
      status: `${DISCORD_MEMBERS} members`,
      tags: ["Community", "Beta testing"]
    }
  ];

  /* ===== Nexus Mods =====
   * `profile` es el nombre de usuario público: el script de estadísticas lo
   * usa para consultar los totales del perfil (visitas, descargas) en la API
   * de Nexus. El enlace visible al perfil sale de `SITE.socials` (clave
   * `nexusmods`), que se construye a partir de esta misma constante; el
   * validador comprueba que ambos sigan apuntando al mismo sitio. */
  root.NEXUS = {
    profile: NEXUS_PROFILE
  };

  /* ===== Mods (Nexus Mods) =====
   * La `url` es la fuente de verdad: el script de estadísticas saca de ahí
   * el juego y el ID del mod, así que no hay que duplicar datos.
   * `stats` = respaldo si `stats.json` no está disponible.
   * `hidden: true` oculta la tarjeta del sitio sin borrar el mod de la lista
   * (útil, por ejemplo, mientras se aclaran los permisos de un port). */
  root.MODS = [
    {
      title: "HoverFish Hats",
      game: "Subnautica",
      description:
        "Cosmetic mod that adds six customizable hats for the Hoverfish, also visible on wild, free-swimming fish. Written in C# with BepInEx and Nautilus.",
      url: "https://www.nexusmods.com/subnautica/mods/2972",
      repo: "https://github.com/jimmyy-67/HoverFish-Hats",
      thumbnail: "img/mods/hoverfish-hats.webp",
      thumbnailFallback: "img/mods/hoverfish-hats.png",
      thumbnailAlt:
        "HoverFish Hats banner: the mod title on a blue background above the six included hats in a row - top hat, mexican, cowboy, sleeping cap, miner helmet and santa.",
      thumbAspect: "2000 / 650",
      width: 2000,
      stats: {
        uniqueDownloads: 604,
        version: "1.0.3"
      }
    },
    {
      title: "SNHardcorePlus - BepInEx Port",
      game: "Subnautica",
      description:
        "Port of qwiso's SNHardcorePlus to BepInEx and Nautilus, keeping the mod alive after QModManager. Around 30 configurable settings for Survival and Hardcore modes. Original concept and code by qwiso.",
      url: "https://www.nexusmods.com/subnautica/mods/2980",
      repo: "https://github.com/jimmyy-67/SNHardcorePlus",
      thumbnail: "img/mods/snhardcoreplus-v2.webp",
      thumbnailFallback: "img/mods/snhardcoreplus-v2.png",
      thumbnailAlt:
        "SNHardcorePlus banner: the mod name in large white letters on a red background with the subtitle BepInEx port, fully configurable hardcore survival by qopp.",
      thumbAspect: "2000 / 650",
      width: 2000,
      stats: {
        uniqueDownloads: 110,
        endorsements: 3,
        version: "2.0"
      }
    }
  ];

  /* ===== Portfolio Gallery =====
   * Las imágenes sin carpeta se resuelven como `img/portfolio/<file>`.
   * Los vídeos locales llevan `poster` explícito; la variante móvil se deriva
   * por convención (`videos/<nombre>-mobile.mp4`). */
  root.GALLERY = {
    unity: [
      {
        file: "MainMenu.webp",
        width: 1920,
        alt: "Refished main menu inside the Unity editor: the crab logo and REFISHED title beside the Singleplayer, Multiplayer, Settings, Achievements and Quit options, next to a hand-drawn panel announcing the 0.15.4 Major Overhaul update.",
        title: "Main Menu",
        description: "Refished main menu"
      },
      {
        file: "MapSelect.webp",
        width: 1920,
        alt: "Refished main menu with the single-player map picker open, showing four map cards - River, Swamp, Reef and Great - each with a preview of its underwater scenery.",
        title: "Map Select",
        description: "Single-player mode map selection"
      },
      {
        file: "FishSelectDeathmatch.webp",
        width: 1920,
        alt: "Refished River map deathmatch screen: a bleak previewed in the centre of the water, its stats and abilities panel on the right, the other selectable fish along the top and a free Play button below.",
        title: "Fish Select · Deathmatch",
        description: "Selectable fish for River Map deathmatch"
      },
      {
        file: "CoralSurvival3PrincipalFish.webp",
        width: 1920,
        alt: "Refished survival fish picker on the coral reef map, with the three main starter fish shown as cards above an info panel describing the goliath grouper as an ambush predator.",
        title: "Survival · Three Main Fish",
        description: "The three main fish of Survival mode"
      },
      {
        file: "CoralMakoBaby.webp",
        width: 1920,
        alt: "A newborn mako shark swimming over a sandy slope in the blue water of Refished survival mode, with the growth meter at stage 1 of 5 and the hunger and health bars in the HUD.",
        title: "Baby Mako",
        description: "A newborn mako shark in Survival mode"
      },
      {
        file: "WhaleSharkBabyGreatMap.webp",
        width: 1920,
        alt: "A spotted baby whale shark gliding above a rocky green seabed on the Great map, with the growth meter at stage 1 of 8 in the Refished survival HUD.",
        title: "Baby Whale Shark",
        description: "A newborn whale shark in Survival mode"
      }
    ],
    godot: [
      {
        file: "img/tree-variant.webp",
        width: 1280,
        fileFallback: "img/tree-variant.png",
        alt: "Retro terminal window titled Pine 1a with a bright green procedural pine tree and grass over a black background; the status bar reads 03/30 sway.",
        title: "Tree? · Sway",
        description: "A procedural pine tree moving through the Sway wind variant in Godot 4.7."
      },
      {
        file: "img/tree-gust.webp",
        width: 1280,
        fileFallback: "img/tree-gust.png",
        alt: "The terminal pine tree leaning to one side under the Gusts wind variant, with the wind meter reading 02/30 gusts and the keyboard shortcuts listed underneath.",
        title: "Tree? · Gusts",
        description: "A stronger wind state showing the tree and grass deformation system."
      },
      {
        file: "img/tree-debug.webp",
        width: 1280,
        fileFallback: "img/tree-debug.png",
        alt: "Terminal pine tree with the debug overlay open, listing variant 6 turbulence, blend 0.55 from 1, frame 03/30, 81 branches, 6237 needles and 60 fps.",
        title: "Tree? · Debug View",
        description: "Technical overlay with wind blending, frame phase, branch and needle counts."
      },
      {
        file: "videos/tree-wind.mp4",
        poster: "img/posters/tree-wind.webp",
        title: "Tree? · Wind Loop",
        description: "A live wind animation showing the tree and grass deformation in motion."
      },
      {
        file: "videos/tree-transition.mp4",
        poster: "img/posters/tree-transition.webp",
        title: "Tree? · Variant Transition",
        description: "Smooth transition between procedural wind variants."
      },
      {
        file: "img/calculator-operation.webp",
        width: 1280,
        fileFallback: "img/calculator-operation.png",
        alt: "Hand-drawn Godot calculator showing the long expression 123 divided by 456 times 789 on its screen above the result 359907.",
        title: "CalculatorGD · Operation",
        description: "A long calculation running through the hand-drawn Godot calculator interface."
      },
      {
        file: "img/calculator-buttons.webp",
        width: 1280,
        fileFallback: "img/calculator-buttons.png",
        alt: "Hand-drawn Godot calculator with the whole keypad in view - clear, backspace, percent and arithmetic keys around the digits - showing the finished calculation 7+2x3x4-6/2 and the result 28.",
        title: "CalculatorGD · Interface",
        description: "The calculator layout, controls and a completed calculation state."
      },
      {
        file: "img/calculator-easteregg.webp",
        width: 1280,
        fileFallback: "img/calculator-easteregg.png",
        alt: "CalculatorGD easter egg: the screen is buried under a collage of meme photos and green faces with the words SIX SEVEN in bright green after typing 67.",
        title: "CalculatorGD · 67 Easter Egg",
        description: "One of the hidden joke effects built into CalculatorGD."
      },
      {
        file: "videos/calculator-input.mp4",
        poster: "img/posters/calculator-input.webp",
        title: "CalculatorGD · Keyboard Input",
        description: "A calculation entered through the keyboard in the Godot interface."
      },
      {
        file: "videos/calculator-easteregg.mp4",
        poster: "img/posters/calculator-easteregg.webp",
        title: "CalculatorGD · 21 Easter Egg Clip",
        description: "The animated hidden joke effect triggered by the 21 result."
      },
      {
        file: "img/aquarings-main.webp",
        width: 1280,
        fileFallback: "img/aquarings-main.png",
        alt: "AquaRings water tank with nine mini basketballs floating in blue water beneath the white ceiling hoop, and the two pump buttons A and D on the green base.",
        title: "AquaRings · Main Tank",
        description:
          "Nine mini basketballs floating inside the water tank beneath the ceiling hoop."
      },
      {
        file: "img/aquarings-pumps.webp",
        width: 1280,
        fileFallback: "img/aquarings-pumps.png",
        alt: "Both AquaRings pumps releasing tall columns of bubbles that push the cluster of mini basketballs upwards through the tank.",
        title: "AquaRings · Pump Action",
        description:
          "The two water pumps fire bubbles through the tank and push every ball at once."
      },
      {
        file: "img/aquarings-hoop.webp",
        width: 1280,
        fileFallback: "img/aquarings-hoop.png",
        alt: "A red mini basketball resting on the rim of the ceiling hoop in AquaRings while the remaining balls sit on the floor of the tank.",
        title: "AquaRings · Ceiling Hoop",
        description:
          "The overhead hoop is the target for the toy's physics-based basketball challenge."
      },
      {
        file: "img/aquarings-chaos.webp",
        width: 1280,
        fileFallback: "img/aquarings-chaos.png",
        alt: "The AquaRings tank filled with bubbles and mini basketballs scattered in mid-flight all around the hoop.",
        title: "AquaRings · Physics Chaos",
        description: "A ball balances above the hoop while the rest settle in the tank below."
      },
      {
        file: "videos/aquarings-pump-demo.mp4",
        poster: "img/posters/aquarings-pump-demo.webp",
        title: "AquaRings · Pump Demo",
        description: "A water pump launches the floating basketballs into motion."
      },
      {
        file: "videos/aquarings-score.mp4",
        poster: "img/posters/aquarings-score.webp",
        title: "AquaRings · Hoop Score",
        description: "A ball approaches the ceiling hoop from above in the water basketball toy."
      },
      {
        file: "videos/aquarings-both-pumps.mp4",
        poster: "img/posters/aquarings-both-pumps.webp",
        title: "AquaRings · Both Pumps",
        description: "Both pumps activate together, sending every ball through the tank at once."
      }
    ],
    environments: [
      {
        file: "videos/RiverShowcase.mp4",
        poster: "img/posters/RiverShowcase.webp",
        title: "River Map Showcase",
        description: "Visualization of how the River Map looks (15s)"
      },
      {
        file: "videos/GreatShowcase.mp4",
        poster: "img/posters/GreatShowcase.webp",
        title: "Great Map Showcase",
        description: "Visualization of how the Great Map looks (21s)"
      }
    ]
  };
})(typeof window !== "undefined" ? window : globalThis);
