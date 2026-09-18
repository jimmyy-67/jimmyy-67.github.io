/* Renderiza el banner de Hoverfish Hats (2000x650) con tipografía Megazoid
 * (título, instalada en el runner por el workflow) + Chakra Petch SemiBold
 * (textos de abajo, pairing elegido) y los 6 hats reales del mod en estilo
 * flat consistente. Solo se commitea el PNG resultante: la fuente demo de
 * DJR no se redistribuye. */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const W = 2000;
const H = 650;
const TITLE_FONT = process.env.TITLE_FONT || "Megazoid";
const out = process.env.OUT || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "img", "mods", "hoverfish-hats.png");

/* Los 6 hats del mod (Config/HatType.cs): TopHat, Mexican, Cowboy,
 * Pajama/Sleeping cap, Miner, Santa. Estilo flat, 2-3 tintas, misma base. */
const hats = {
  top: `<ellipse cx="0" cy="-6" rx="60" ry="12" fill="#1d2126"/><rect x="-38" y="-98" width="76" height="92" rx="7" fill="#1d2126"/><rect x="-38" y="-34" width="76" height="15" fill="#b3372f"/>`,
  mexican: `<ellipse cx="0" cy="-4" rx="74" ry="15" fill="#b07b3e"/><ellipse cx="0" cy="-8" rx="74" ry="14" fill="#d9a066"/><path d="M-34,-10 Q-34,-72 0,-76 Q34,-72 34,-10 Z" fill="#d9a066"/><rect x="-34" y="-30" width="68" height="12" fill="#b3372f"/>`,
  cowboy: `<path d="M-70,-6 Q-44,-30 -20,-24 L20,-24 Q44,-30 70,-6 Q40,10 0,10 Q-40,10 -70,-6 Z" fill="#6e452c"/><path d="M-30,-22 L-30,-62 Q-30,-84 -14,-77 Q0,-71 14,-77 Q30,-84 30,-62 L30,-22 Z" fill="#8b5a3c"/><rect x="-30" y="-34" width="60" height="12" fill="#4a2e1d"/>`,
  sleeping: `<rect x="-40" y="-20" width="80" height="20" rx="10" fill="#f4f6f8"/><path d="M-34,-20 C-32,-72 -4,-98 30,-94 C46,-92 52,-80 48,-68 C42,-76 28,-78 18,-70 C2,-57 4,-38 6,-20 Z" fill="#3f6fb5"/><circle cx="50" cy="-70" r="12" fill="#f4f6f8"/>`,
  miner: `<path d="M-50,-8 A50,50 0 0 1 50,-8 Z" fill="#f2c230"/><rect x="-58" y="-12" width="116" height="11" rx="5.5" fill="#d0a019"/><circle cx="0" cy="-40" r="13" fill="#6b7280"/><circle cx="0" cy="-40" r="7" fill="#fff7c0"/>`,
  santa: `<rect x="-42" y="-20" width="84" height="20" rx="10" fill="#f4f6f8"/><path d="M36,-20 C34,-74 6,-100 -28,-96 C-44,-94 -50,-82 -46,-70 C-40,-78 -26,-80 -16,-72 C0,-59 -2,-38 -4,-20 Z" fill="#c0392b"/><circle cx="-48" cy="-72" r="12" fill="#f4f6f8"/>`
};
const names = ["top hat", "mexican", "cowboy", "sleeping cap", "miner helmet", "santa"];
const row = Object.keys(hats)
  .map((k, i) => {
    const x = (W * (i + 0.5)) / 6;
    return (
      `<g transform="translate(${x} 560)">${hats[k]}</g>` +
      `<text x="${x}" y="632" font-family="Chakra Petch" font-weight="600" font-size="20" letter-spacing="2" fill="#bfe0f5" text-anchor="middle">${names[i].toUpperCase()}</text>`
    );
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#1e88c7"/>
  <text x="${W / 2 + 7}" y="212" font-family="${TITLE_FONT}" font-size="112" fill="#0f5c8c" text-anchor="middle">HOVERFISH HATS</text>
  <text x="${W / 2}" y="205" font-family="${TITLE_FONT}" font-size="112" fill="#ffffff" text-anchor="middle">HOVERFISH HATS</text>
  <rect x="${W / 2 - 300}" y="252" width="600" height="4" fill="#ffffff" opacity="0.85"/>
  <text x="${W / 2}" y="332" font-family="Chakra Petch" font-weight="600" font-size="48" fill="#ffffff" text-anchor="middle">6 customizable hats for the Hoverfish</text>
  <text x="${W / 2}" y="392" font-family="Chakra Petch" font-weight="600" font-size="34" fill="#cfe8f7" text-anchor="middle">by qopp · cosmetic mod · Subnautica</text>
  ${row}
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log("rendered", out, "with title font:", TITLE_FONT);
