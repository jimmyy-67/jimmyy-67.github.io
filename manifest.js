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
 * Textos alternativos: cada imagen lleva su descripción obligatoria (`alt` en
 * la galería, `thumbnailAlt` en proyectos y mods). Describe lo que SE VE, no
 * el nombre del archivo ni el título, que ya se muestran aparte; en los clips
 * de vídeo ese mismo texto viaja como `aria-label`. Los iconos decorativos
 * (`icon`) no lo llevan: se publican con `alt=""`.
 *
 * Idioma: todo el contenido visible (y el que leen los lectores de pantalla)
 * va en inglés, igual que `<html lang="en">`. Los comentarios y la
 * documentación del repositorio van en español.
 *
 * `scripts/check-content.mjs` verifica estas reglas en CI.
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
        "Six baby sea turtles swimming in formation over a sunlit orange sandbank in Refished, with rays of light crossing the water.",
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
        "Retro terminal window in green on black drawing a procedural pine tree over a strip of grass, with the wind frame counter and the keyboard shortcuts listed underneath.",
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
        "Hand-drawn slate-blue calculator on a cream background showing the operation 1234x56 and its result, 69104, on the display.",
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
        "Green handheld water toy holding a blue tank: nine coloured mini basketballs float under a small hoop and two round buttons labelled A and D sit along the base.",
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
   * `stats` = respaldo si `stats.json` no está disponible (se refresca a mano
   * con los valores de `stats.json`; `check-content.mjs` avisa si se desvían).
   * `hidden: true` oculta la tarjeta del sitio sin borrar el mod de la lista
   * (útil, por ejemplo, mientras se aclaran los permisos de un port). */
  root.MODS = [
    {
      title: "Hoverfish Hats",
      game: "Subnautica",
      description:
        "Cosmetic mod that adds six customizable hats for the Hoverfish, also visible on wild, free-swimming fish. Written in C# with BepInEx and Nautilus.",
      url: "https://www.nexusmods.com/subnautica/mods/2972",
      repo: "https://github.com/jimmyy-67/HoverFish-Hats",
      thumbnail: "img/mods/hoverfish-hats.webp",
      thumbnailFallback: "img/mods/hoverfish-hats.png",
      thumbnailAlt:
        "Hoverfish Hats banner: the title in bold white letters on a blue background, above a row with the six hats the mod adds - top hat, Mexican hat, cowboy hat, sleeping cap, miner helmet and Santa hat.",
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
        "SNHardcorePlus banner: the title in wide white stencil letters on a red background, with the lines BepInEx port and by qopp, fully configurable, hardcore survival underneath.",
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
        title: "Main Menu",
        description: "Refished main menu",
        alt: "Refished main menu inside the Unity editor: the white crab logo over the Singleplayer, Multiplayer, Settings, Achievements and Quit options, next to a crayon-style Update 0.15.4 Major Overhaul banner with two sharks and a blue fish."
      },
      {
        file: "MapSelect.webp",
        title: "Map Select",
        description: "Single-player mode map selection",
        alt: "Single-player map selection in the Unity editor showing the four Refished maps - River, Swamp, Reef and Great - as illustrated cards side by side."
      },
      {
        file: "FishSelectDeathmatch.webp",
        title: "Fish Select · Deathmatch",
        description: "Selectable fish for River Map deathmatch",
        alt: "Deathmatch fish selection on the River map: a bleak previewed in 3D beside its stats panel, three empty ability slots and a Play button marked free."
      },
      {
        file: "CoralSurvival3PrincipalFish.webp",
        title: "Survival · Three Main Fish",
        description: "The three main fish of Survival mode",
        alt: "Survival fish selection on the Coral map with the three starting fish shown as underwater cards and an info panel describing the goliath grouper as an ambush predator."
      },
      {
        file: "CoralMakoBaby.webp",
        title: "Baby Mako",
        description: "A newborn mako shark in Survival mode",
        alt: "A newborn mako shark swimming over the pale sandy seabed of the Coral map, with the growth and hunger bars of Survival mode at the bottom of the screen."
      },
      {
        file: "WhaleSharkBabyGreatMap.webp",
        title: "Baby Whale Shark",
        description: "A newborn whale shark in Survival mode",
        alt: "A spotted baby whale shark gliding over a rocky ridge in the turquoise water of the Great map, with the Survival mode bars at the bottom of the screen."
      }
    ],
    godot: [
      {
        file: "img/tree-variant.png",
        title: "Tree? · Sway",
        description: "A procedural pine tree moving through the Sway wind variant in Godot 4.7.",
        alt: "Terminal window where a green procedural pine tree leans gently to one side; the status bar reads frame 03/30, sway."
      },
      {
        file: "img/tree-gust.png",
        title: "Tree? · Gusts",
        description: "A stronger wind state showing the tree and grass deformation system.",
        alt: "The same green pine tree bent harder to the right, its branches and the grass at the base flattened by the wind; the status bar reads frame 02/30, gusts."
      },
      {
        file: "img/tree-debug.png",
        title: "Tree? · Debug View",
        description: "Technical overlay with wind blending, frame phase, branch and needle counts.",
        alt: "Debug overlay next to the pine tree listing variant 6 turbulence, blend 0.55 from 1, frame 03/30, 81 branches, 6237 needles and 60 fps."
      },
      {
        file: "videos/tree-wind.mp4",
        title: "Tree? · Wind Loop",
        description: "A live wind animation showing the tree and grass deformation in motion.",
        alt: "Looping clip of the green terminal pine tree and the grass under it bending back and forth as the wind simulation runs."
      },
      {
        file: "videos/tree-transition.mp4",
        title: "Tree? · Variant Transition",
        description: "Smooth transition between procedural wind variants.",
        alt: "Clip of the terminal pine tree blending from one procedural wind variant into the next without cuts."
      },
      {
        file: "img/calculator-operation.png",
        title: "CalculatorGD · Operation",
        description:
          "A long calculation running through the hand-drawn Godot calculator interface.",
        alt: "Hand-drawn calculator with the chained operation 123+456x789 typed on its dark display and the result 359907 underneath."
      },
      {
        file: "img/calculator-buttons.png",
        title: "CalculatorGD · Interface",
        description: "The calculator layout, controls and a completed calculation state.",
        alt: "Full view of the calculator keypad - digits, clear, backspace, percent and the orange operator column - with the operation 7+2x3x4-6/2 solved as 28."
      },
      {
        file: "img/calculator-easteregg.png",
        title: "CalculatorGD · 67 Easter Egg",
        description: "One of the hidden joke effects built into CalculatorGD.",
        alt: "The hidden 67 easter egg taking over the screen with scattered meme photos, glitch faces, the number 67 repeated and the words SIX SEVEN."
      },
      {
        file: "videos/calculator-input.mp4",
        title: "CalculatorGD · Keyboard Input",
        description: "A calculation entered through the keyboard in the Godot interface.",
        alt: "Clip of a calculation being typed on the keyboard, digit by digit, and solved by the hand-drawn Godot calculator."
      },
      {
        file: "videos/calculator-easteregg.mp4",
        title: "CalculatorGD · 21 Easter Egg Clip",
        description: "The animated hidden joke effect triggered by the 21 result.",
        alt: "Clip of the animated joke effect that takes over the calculator screen when the result is 21."
      },
      {
        file: "img/aquarings-main.png",
        title: "AquaRings · Main Tank",
        description:
          "Nine mini basketballs floating inside the water tank beneath the ceiling hoop.",
        alt: "The AquaRings tank at rest: nine coloured mini basketballs floating in blue water below the small ceiling hoop, with the A and D pump buttons on the green base."
      },
      {
        file: "img/aquarings-pumps.png",
        title: "AquaRings · Pump Action",
        description:
          "The two water pumps fire bubbles through the tank and push every ball at once.",
        alt: "Two columns of bubbles rise from the bottom corners of the tank and push the mini basketballs together toward the middle of the water."
      },
      {
        file: "img/aquarings-hoop.png",
        title: "AquaRings · Ceiling Hoop",
        description:
          "The overhead hoop is the target for the toy's physics-based basketball challenge.",
        alt: "A single ball balanced on the rim of the ceiling hoop while the remaining basketballs rest in a line at the bottom of the tank."
      },
      {
        file: "img/aquarings-chaos.png",
        title: "AquaRings · Physics Chaos",
        description: "A ball balances above the hoop while the rest settle in the tank below.",
        alt: "The tank filled with bubbles and basketballs scattered in every direction around the hoop while both pumps are running."
      },
      {
        file: "videos/aquarings-pump-demo.mp4",
        title: "AquaRings · Pump Demo",
        description: "A water pump launches the floating basketballs into motion.",
        alt: "Clip of one pump firing a jet of water and bubbles that launches the floating basketballs upward."
      },
      {
        file: "videos/aquarings-score.mp4",
        title: "AquaRings · Hoop Score",
        description: "A ball approaches the ceiling hoop from above in the water basketball toy.",
        alt: "Clip of a basketball drifting up to the ceiling hoop and dropping through it inside the water tank."
      },
      {
        file: "videos/aquarings-both-pumps.mp4",
        title: "AquaRings · Both Pumps",
        description: "Both pumps activate together, sending every ball through the tank at once.",
        alt: "Clip of both pumps firing at the same time and sweeping every basketball across the tank at once."
      }
    ],
    environments: [
      {
        file: "videos/RiverShowcase.mp4",
        title: "River Map Showcase",
        description: "Visualization of how the River Map looks (15s)",
        alt: "Fifteen-second camera tour of the River map in Refished, showing its underwater scenery end to end."
      },
      {
        file: "videos/GreatShowcase.mp4",
        title: "Great Map Showcase",
        description: "Visualization of how the Great Map looks (21s)",
        alt: "Twenty-one-second camera tour of the Great map in Refished, showing its underwater scenery end to end."
      }
    ]
  };
})(typeof window !== "undefined" ? window : globalThis);
