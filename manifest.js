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
 *
 * Textos alternativos: toda imagen de contenido lleva su descripción aquí
 * (`alt` en la galería, `thumbnailAlt` en proyectos y mods). Debe explicar
 * qué se ve, no repetir el título ni el nombre del archivo; los vídeos no lo
 * usan porque se describen con `title` + `description`. Los iconos
 * decorativos (`icon`) se renderizan con alt vacío a propósito.
 * ==========================================================================*/
(function (root) {
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
      thumbnail: "img/portfolio/TerminalPine.png?v=2",
      thumbnailAlt:
        "Retro terminal window labelled Pine 1a with a bright green procedural pine tree and grass drawn over a black background, plus the wind meter and keyboard shortcuts.",
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
      thumbnail: "img/projects/calculator/screenshot.png?v=1",
      thumbnailAlt:
        "Hand-drawn Godot calculator app showing the operation 1234x56 above the result 69104.",
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
      thumbnail: "img/aquarings-main.png?v=1",
      thumbnailAlt:
        "AquaRings water tank with nine mini basketballs floating in blue water beneath a white ceiling hoop, and the two pump buttons A and D on the green base.",
      status: "Released",
      tags: ["Godot 4.7", "GDScript", "2D Physics"]
    },
    {
      title: "Refished Wiki",
      kind: "Community docs",
      description: "Community wiki with full documentation of fish species, maps and mechanics.",
      url: "https://feed-and-grow-refished.fandom.com/wiki/Main_Page",
      linkLabel: "Visit wiki",
      icon: "img/fandom.svg",
      status: "Live",
      tags: ["Fandom", "Community docs"]
    },
    {
      title: "Discord Server",
      kind: "Community",
      description:
        "600+ members. An active community for feedback, beta testing and development updates.",
      url: "https://discord.gg/MBr2QaUfBg",
      linkLabel: "Join server",
      icon: "img/discord.svg",
      status: "600+ members",
      tags: ["Community", "Beta testing"]
    }
  ];

  /* ===== Nexus Mods =====
   * `profile` es el nombre de usuario público: lo usan tanto el enlace
   * "All mods on Nexus Mods" como el script de estadísticas para consultar
   * los totales del perfil (visitas, descargas totales) en la API de Nexus. */
  root.NEXUS = {
    profile: "qopp"
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
      stats: {
        uniqueDownloads: 110,
        endorsements: 3,
        version: "2.0"
      }
    }
  ];

  /* ===== Portfolio Gallery ===== */
  root.GALLERY = {
    unity: [
      {
        file: "MainMenu.webp",
        alt: "Refished main menu inside the Unity editor: the crab logo and REFISHED title beside the Singleplayer, Multiplayer, Settings, Achievements and Quit options, next to a hand-drawn panel announcing the 0.15.4 Major Overhaul update.",
        title: "Main Menu",
        description: "Refished main menu"
      },
      {
        file: "MapSelect.webp",
        alt: "Refished main menu with the single-player map picker open, showing four map cards - River, Swamp, Reef and Great - each with a preview of its underwater scenery.",
        title: "Map Select",
        description: "Single-player mode map selection"
      },
      {
        file: "FishSelectDeathmatch.webp",
        alt: "Refished River map deathmatch screen: a bleak previewed in the centre of the water, its stats and abilities panel on the right, the other selectable fish along the top and a free Play button below.",
        title: "Fish Select · Deathmatch",
        description: "Selectable fish for River Map deathmatch"
      },
      {
        file: "CoralSurvival3PrincipalFish.webp",
        alt: "Refished survival fish picker on the coral reef map, with the three main starter fish shown as cards above an info panel describing the goliath grouper as an ambush predator.",
        title: "Survival · Three Main Fish",
        description: "The three main fish of Survival mode"
      },
      {
        file: "CoralMakoBaby.webp",
        alt: "A newborn mako shark swimming over a sandy slope in the blue water of Refished survival mode, with the growth meter at stage 1 of 5 and the hunger and health bars in the HUD.",
        title: "Baby Mako",
        description: "A newborn mako shark in Survival mode"
      },
      {
        file: "WhaleSharkBabyGreatMap.webp",
        alt: "A spotted baby whale shark gliding above a rocky green seabed on the Great map, with the growth meter at stage 1 of 8 in the Refished survival HUD.",
        title: "Baby Whale Shark",
        description: "A newborn whale shark in Survival mode"
      }
    ],
    godot: [
      {
        file: "img/tree-variant.png",
        alt: "Retro terminal window titled Pine 1a with a bright green procedural pine tree and grass over a black background; the status bar reads 03/30 sway.",
        title: "Tree? · Sway",
        description: "A procedural pine tree moving through the Sway wind variant in Godot 4.7."
      },
      {
        file: "img/tree-gust.png",
        alt: "The terminal pine tree leaning to one side under the Gusts wind variant, with the wind meter reading 02/30 gusts and the keyboard shortcuts listed underneath.",
        title: "Tree? · Gusts",
        description: "A stronger wind state showing the tree and grass deformation system."
      },
      {
        file: "img/tree-debug.png",
        alt: "Terminal pine tree with the debug overlay open, listing variant 6 turbulence, blend 0.55 from 1, frame 03/30, 81 branches, 6237 needles and 60 fps.",
        title: "Tree? · Debug View",
        description: "Technical overlay with wind blending, frame phase, branch and needle counts."
      },
      {
        file: "videos/tree-wind.mp4",
        title: "Tree? · Wind Loop",
        description: "A live wind animation showing the tree and grass deformation in motion."
      },
      {
        file: "videos/tree-transition.mp4",
        title: "Tree? · Variant Transition",
        description: "Smooth transition between procedural wind variants."
      },
      {
        file: "img/calculator-operation.png",
        alt: "Hand-drawn Godot calculator showing the long expression 123 divided by 456 times 789 on its screen above the result 359907.",
        title: "CalculatorGD · Operation",
        description: "A long calculation running through the hand-drawn Godot calculator interface."
      },
      {
        file: "img/calculator-buttons.png",
        alt: "Hand-drawn Godot calculator with the whole keypad in view - clear, backspace, percent and arithmetic keys around the digits - showing the finished calculation 7+2x3x4-6/2 and the result 28.",
        title: "CalculatorGD · Interface",
        description: "The calculator layout, controls and a completed calculation state."
      },
      {
        file: "img/calculator-easteregg.png",
        alt: "CalculatorGD easter egg: the screen is buried under a collage of meme photos and green faces with the words SIX SEVEN in bright green after typing 67.",
        title: "CalculatorGD · 67 Easter Egg",
        description: "One of the hidden joke effects built into CalculatorGD."
      },
      {
        file: "videos/calculator-input.mp4",
        title: "CalculatorGD · Keyboard Input",
        description: "A calculation entered through the keyboard in the Godot interface."
      },
      {
        file: "videos/calculator-easteregg.mp4",
        title: "CalculatorGD · 21 Easter Egg Clip",
        description: "The animated hidden joke effect triggered by the 21 result."
      },
      {
        file: "img/aquarings-main.png",
        alt: "AquaRings water tank with nine mini basketballs floating in blue water beneath the white ceiling hoop, and the two pump buttons A and D on the green base.",
        title: "AquaRings · Main Tank",
        description:
          "Nine mini basketballs floating inside the water tank beneath the ceiling hoop."
      },
      {
        file: "img/aquarings-pumps.png",
        alt: "Both AquaRings pumps releasing tall columns of bubbles that push the cluster of mini basketballs upwards through the tank.",
        title: "AquaRings · Pump Action",
        description:
          "The two water pumps fire bubbles through the tank and push every ball at once."
      },
      {
        file: "img/aquarings-hoop.png",
        alt: "A red mini basketball resting on the rim of the ceiling hoop in AquaRings while the remaining balls sit on the floor of the tank.",
        title: "AquaRings · Ceiling Hoop",
        description:
          "The overhead hoop is the target for the toy's physics-based basketball challenge."
      },
      {
        file: "img/aquarings-chaos.png",
        alt: "The AquaRings tank filled with bubbles and mini basketballs scattered in mid-flight all around the hoop.",
        title: "AquaRings · Physics Chaos",
        description: "A ball balances above the hoop while the rest settle in the tank below."
      },
      {
        file: "videos/aquarings-pump-demo.mp4",
        title: "AquaRings · Pump Demo",
        description: "A water pump launches the floating basketballs into motion."
      },
      {
        file: "videos/aquarings-score.mp4",
        title: "AquaRings · Hoop Score",
        description: "A ball approaches the ceiling hoop from above in the water basketball toy."
      },
      {
        file: "videos/aquarings-both-pumps.mp4",
        title: "AquaRings · Both Pumps",
        description: "Both pumps activate together, sending every ball through the tank at once."
      }
    ],
    environments: [
      {
        file: "videos/RiverShowcase.mp4",
        title: "River Map Showcase",
        description: "Visualization of how the River Map looks (15s)"
      },
      {
        file: "videos/GreatShowcase.mp4",
        title: "Great Map Showcase",
        description: "Visualization of how the Great Map looks (21s)"
      }
    ]
  };
})(typeof window !== "undefined" ? window : globalThis);
