/* ============================================================================
 * manifest.js - contenido editable del portfolio
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

I'm Jimmy, an indie game developer working with Unity and C#. I specialize in programming, game design and localization.

### Background

Over a year of independent game development experience. My main project is **Refished**, a free unofficial fan remake of FAG:F.

### Services

- **C# Programming:** Mechanics, systems and game logic in Unity
- **Game Design:** Gameplay, balancing and player experience
- **Translations:** Content localization (Spanish / English)

### Tech Stack

Unity 6 · C# · Git · GitHub · Fandom Wiki

### Languages

Spanish (native) · English (B2)

---

*Available for freelance projects and collaborations.*

`;

  /* ===== Works / Projects ===== */
  root.WORKS = [
    {
      "title": "Refished",
      "kind": "Game",
      "description": "Free unofficial fan remake of FAG:F. Solo developed in Unity 6, with updates whose timing varies by update size.",
      "url": "https://j1mmyy.itch.io/refished",
      "linkLabel": "Play on itch.io",
      "thumbnail": "img/portfolio/baby-turtle.webp",
      "thumbnailFallback": "img/portfolio/baby-turtle.png",
      "status": "Active development",
      "tags": ["Unity 6", "C#", "Solo dev"]
    },
    {
      "title": "Tree?",
      "kind": "Creative coding",
      "description": "A procedural pine tree rendered as vector assets inside a retro terminal frame, with ten switchable wind animations. Everything on screen is generated from code.",
      "url": "https://github.com/jimmyy-67/Tree",
      "linkLabel": "View source",
      "thumbnail": "img/portfolio/TerminalPine.png?v=2",
      "status": "New",
      "tags": ["Godot 4.7", "GDScript", "Procedural animation"]
    },
    {
      "title": "CalculatorGD",
      "kind": "Utility app",
      "description": "A small hand-drawn calculator made with Godot 4.7. It supports keyboard input, basic operations and hidden jokes for special results.",
      "url": "https://github.com/jimmyy-67/CalculatorGD",
      "linkLabel": "View source",
      "thumbnail": "img/projects/calculator/screenshot.png?v=1",
      "status": "Released",
      "tags": ["Godot 4.7", "GDScript", "UI / UX"]
    },
    {
      "title": "Refished Wiki",
      "kind": "Community docs",
      "description": "Community wiki with full documentation of fish species, maps and mechanics.",
      "url": "https://feed-and-grow-refished.fandom.com/wiki/Main_Page",
      "linkLabel": "Visit wiki",
      "icon": "img/fandom.svg",
      "status": "Live",
      "tags": ["Fandom", "Community docs"]
    },
    {
      "title": "Discord Server",
      "kind": "Community",
      "description": "600+ members. An active community for feedback, beta testing and development updates.",
      "url": "https://discord.gg/MBr2QaUfBg",
      "linkLabel": "Join server",
      "icon": "img/discord.svg",
      "status": "600+ members",
      "tags": ["Community", "Beta testing"]
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
      "description": "Cosmetic mod that adds six customizable hats for the Hoverfish, also visible on wild, free-swimming fish. Written in C# with BepInEx and Nautilus.",
      "url": "https://www.nexusmods.com/subnautica/mods/2972",
      "repo": "https://github.com/jimmyy-67/HoverFish-Hats",
      "thumbnail": "img/mods/hoverfish-hats.webp",
      "thumbnailFallback": "img/mods/hoverfish-hats.png",
      "thumbAspect": "2000 / 650",
      "stats": {
        "uniqueDownloads": 593,
        "version": "1.0.3"
      }
    },
    {
      "title": "SNHardcorePlus - BepInEx Port",
      "game": "Subnautica",
      "description": "Port of qwiso's SNHardcorePlus to BepInEx and Nautilus, keeping the mod alive after QModManager. Around 30 configurable settings for Survival and Hardcore modes. Original concept and code by qwiso.",
      "url": "https://www.nexusmods.com/subnautica/mods/2980",
      "repo": "https://github.com/jimmyy-67/SNHardcorePlus",
      "thumbnail": "img/mods/snhardcoreplus-v2.webp",
      "thumbnailFallback": "img/mods/snhardcoreplus-v2.png",
      "thumbAspect": "2000 / 650",
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
        "file": "MainMenu.webp",
        "title": "Main Menu",
        "description": "Refished main menu"
      },
      {
        "file": "MapSelect.webp",
        "title": "Map Select",
        "description": "Single-player mode map selection"
      },
      {
        "file": "FishSelectDeathmatch.webp",
        "title": "Fish Select · Deathmatch",
        "description": "Selectable fish for River Map deathmatch"
      },
      {
        "file": "CoralSurvival3PrincipalFish.webp",
        "title": "Survival · Three Main Fish",
        "description": "The three main fish of Survival mode"
      },
      {
        "file": "CoralMakoBaby.webp",
        "title": "Baby Mako",
        "description": "A newborn mako shark in Survival mode"
      },
      {
        "file": "WhaleSharkBabyGreatMap.webp",
        "title": "Baby Whale Shark",
        "description": "A newborn whale shark in Survival mode"
      }
    ],
    "godot": [
      {
        "file": "img/tree-variant.png",
        "title": "Tree? · Sway",
        "description": "A procedural pine tree moving through the Sway wind variant in Godot 4.7."
      },
      {
        "file": "img/tree-gust.png",
        "title": "Tree? · Gusts",
        "description": "A stronger wind state showing the tree and grass deformation system."
      },
      {
        "file": "img/tree-debug.png",
        "title": "Tree? · Debug View",
        "description": "Technical overlay with wind blending, frame phase, branch and needle counts."
      },
      {
        "file": "videos/tree-wind.mp4",
        "title": "Tree? · Wind Loop",
        "description": "A live wind animation showing the tree and grass deformation in motion."
      },
      {
        "file": "videos/tree-transition.mp4",
        "title": "Tree? · Variant Transition",
        "description": "Smooth transition between procedural wind variants."
      },
      {
        "file": "img/calculator-operation.png",
        "title": "CalculatorGD · Operation",
        "description": "A long calculation running through the hand-drawn Godot calculator interface."
      },
      {
        "file": "img/calculator-buttons.png",
        "title": "CalculatorGD · Interface",
        "description": "The calculator layout, controls and a completed calculation state."
      },
      {
        "file": "img/calculator-easteregg.png",
        "title": "CalculatorGD · 67 Easter Egg",
        "description": "One of the hidden joke effects built into CalculatorGD."
      },
      {
        "file": "videos/calculator-input.mp4",
        "title": "CalculatorGD · Keyboard Input",
        "description": "A calculation entered through the keyboard in the Godot interface."
      },
      {
        "file": "videos/calculator-easteregg.mp4",
        "title": "CalculatorGD · 67 Easter Egg Clip",
        "description": "The animated hidden joke effect triggered by a special result."
      }
    ],
    "roblox-vfx": [],
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
