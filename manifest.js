/* ============================================================================
 * manifest.js — contenido editable del portfolio
 *
 * Se publica tal cual en el navegador y, además, lo lee el script de Node
 * `scripts/fetch-nexus-stats.mjs` para saber qué mods hay que consultar en la
 * API de Nexus Mods. Por eso todo va dentro de un IIFE que escribe en
 * `window` (navegador) o en `globalThis` (Node): una sola fuente de verdad.
 *
 * Los números de `stats` son solo un respaldo: si existe `stats.json`, la web
 * muestra los datos reales de la API y estos quedan ignorados.
 * ==========================================================================*/
(function (root) {

  /* ===== About Me (Markdown) ===== */
  root.ABOUT = `## About

I'm Jimmy, indie game developer working with Unity and C#. I specialize in programming, game design and localization.

### Background

Over a year of independent game development. My main project is **Refished**, a free unofficial fan remake of FAG:F.

### Services

- **C# Programming:** Mechanics, systems and game logic in Unity
- **Game Design:** Gameplay, balancing and player experience
- **Translations:** Content localization (Spanish / English)

### Tech Stack

Unity 6000 · C# · Git · GitHub · Fandom Wiki

### Languages

Spanish (native) · English (B2)

---

*Available for freelance projects and collaborations.*

`;

  /* ===== Works / Projects ===== */
  root.WORKS = [
    {
      "title": "Refished",
      "description": "Free unofficial fan remake of FAG:F. Solo developed in Unity 6000. Active beta with updates every 1-3 months.",
      "url": "https://j1mmyy.itch.io/refished",
      "thumbnail": "https://raw.githubusercontent.com/jimmyy-67/jimmyy-67.github.io/main/img/portfolio/baby-turtle.png"
    },
    {
      "title": "Refished Wiki",
      "description": "Community wiki with full documentation on fish species, maps and mechanics.",
      "url": "https://feed-and-grow-refished.fandom.com/wiki/Main_Page",
      "thumbnail": ""
    },
    {
      "title": "Discord Server",
      "description": "600+ members. Active community for feedback, beta testing and dev updates.",
      "url": "https://discord.gg/MBr2QaUfBg",
      "thumbnail": ""
    }
  ];

  /* ===== Nexus Mods =====
   * `profile` es el nombre de usuario público: lo usan tanto el enlace
   * "All mods on Nexus Mods" como el script de estadísticas para consultar
   * los totales del perfil (visitas, descargas totales) en la API de Nexus. */
  root.NEXUS = {
    "profile": "qopp"
  };

  /* ===== Mods (Nexus Mods) =====
   * La `url` es la fuente de verdad: el script de estadísticas saca de ahí
   * el juego y el ID del mod, así que no hay que duplicar datos.
   * `stats` = respaldo si `stats.json` no está disponible.
   * `hidden: true` oculta la tarjeta del sitio sin borrar el mod de la lista
   * (útil, por ejemplo, mientras se aclaran los permisos de un port). */
  root.MODS = [
    {
      "title": "Hoverfish Hats",
      "game": "Subnautica",
      "description": "Cosmetic mod that adds 6 customizable hats for the Hoverfish, visible on wild free-swimming fish too. Written in C# with BepInEx and Nautilus.",
      "url": "https://www.nexusmods.com/subnautica/mods/2972",
      "repo": "https://github.com/jimmyy-67/HoverFish-Hats",
      "thumbnail": "https://staticdelivery.nexusmods.com/mods/1155/images/headers/2972_1771191477.jpg",
      "thumbnailFallback": "https://staticdelivery.nexusmods.com/mods/1155/images/thumbnails/2972/2972-1771191639-1205033704.jpg",
      "stats": {
        "uniqueDownloads": 593,
        "version": "1.0.3"
      }
    },
    {
      "title": "SNHardcorePlus - BepInEx Port",
      "game": "Subnautica",
      "description": "Port of qwiso's SNHardcorePlus to BepInEx and Nautilus, keeping the mod alive after QModManager. Around 30 configurable values for Survival and Hardcore runs. Original concept and code by qwiso.",
      "url": "https://www.nexusmods.com/subnautica/mods/2980",
      "repo": "",
      "thumbnail": "https://staticdelivery.nexusmods.com/mods/1155/images/headers/2980_1769986824.jpg",
      "thumbnailFallback": "https://staticdelivery.nexusmods.com/mods/1155/images/thumbnails/2980/2980-1769987758-22465514.jpg",
      "stats": {
        "uniqueDownloads": 105,
        "endorsements": 3,
        "version": "1.0"
      }
    }
  ];

  /* ===== Portfolio Gallery ===== */
  root.GALLERY = {
    "unity": [
      {
        "file": "MainMenu.png",
        "title": "Main Menu",
        "description": "Refished main menu"
      },
      {
        "file": "MapSelect.png",
        "title": "Map Select",
        "description": "Single-player mode map selection"
      },
      {
        "file": "FishSelectDeathmatch.png",
        "title": "Fish Select · Deathmatch",
        "description": "Selectable fish for River Map deathmatch"
      },
      {
        "file": "CoralSurvival3PrincipalFish.png",
        "title": "Survival · Three Main Fish",
        "description": "The three main fish of Survival mode"
      },
      {
        "file": "CoralMakoBaby.png",
        "title": "Baby Mako",
        "description": "A newborn mako shark in Survival mode"
      },
      {
        "file": "WhaleSharkBabyGreatMap.png",
        "title": "Baby Whale Shark",
        "description": "A newborn whale shark in Survival mode"
      }
    ],
    "models": [],
    "environments": [
      {
        "file": "videos/RiverShowcase.mp4",
        "title": "River Map Showcase",
        "description": "Visualization of how the River Map looks (15s)"
      },
      {
        "file": "videos/GreatShowcase.mp4",
        "title": "Great Map Showcase",
        "description": "Visualization of how the Great Map looks (21s)"
      }
    ]
  };

})(typeof window !== "undefined" ? window : globalThis);
