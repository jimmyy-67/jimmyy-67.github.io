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
  top: `<ellipse cx="0" cy="10" rx="60" ry="8" fill="#0f5c8c" opacity="0.5"/>
    <ellipse cx="0" cy="-6" rx="60" ry="10" fill="#23282e"/>
    <path d="M-34,-10 C-36,-40 -38,-70 -40,-92 Q0,-102 40,-92 C38,-70 36,-40 34,-10 Z" fill="#1d2126"/>
    <ellipse cx="0" cy="-92" rx="40" ry="9" fill="#2a3037"/>
    <path d="M-35.5,-24 L35.5,-24 L37,-40 L-37,-40 Z" fill="#b3372f"/>
    <rect x="-26" y="-86" width="7" height="58" rx="3.5" fill="#ffffff" opacity="0.08"/>`,
  mexican: `<ellipse cx="0" cy="10" rx="76" ry="8" fill="#0f5c8c" opacity="0.5"/>
    <path d="M-80,-10 C-52,-24 -26,-28 0,-28 C26,-28 52,-24 80,-10 C52,2 26,6 0,6 C-26,6 -52,2 -80,-10 Z" fill="#d9a066"/>
    <path d="M-64,-9 C-40,-19 -20,-22 0,-22 C20,-22 40,-19 64,-9" fill="none" stroke="#b07b3e" stroke-width="3"/>
    <path d="M-26,-24 C-26,-58 -24,-74 -18,-82 C-10,-90 10,-90 18,-82 C24,-74 26,-58 26,-24 Z" fill="#d9a066"/>
    <path d="M0,-89 C8,-88 14,-85 18,-82 C24,-74 26,-58 26,-24 L12,-24 C12,-56 8,-76 0,-89 Z" fill="#ca9054"/>
    <path d="M-26,-24 L26,-24 L24.5,-38 L-24.5,-38 Z" fill="#b3372f"/>`,
  cowboy: `<ellipse cx="0" cy="12" rx="70" ry="8" fill="#0f5c8c" opacity="0.5"/>
    <path d="M-74,-4 C-64,-22 -46,-20 -30,-16 L30,-16 C46,-20 64,-22 74,-4 C56,8 30,12 0,12 C-30,12 -56,8 -74,-4 Z" fill="#8b5a3c"/>
    <path d="M-74,-4 C-56,8 -30,12 0,12 C30,12 56,8 74,-4 C56,4 30,8 0,8 C-30,8 -56,4 -74,-4 Z" fill="#6e452c"/>
    <path d="M-26,-14 C-27,-44 -26,-64 -20,-74 C-14,-82 -8,-76 0,-76 C8,-76 14,-82 20,-74 C26,-64 27,-44 26,-14 Z" fill="#8b5a3c"/>
    <path d="M-12,-76 Q0,-60 12,-76 Q0,-68 -12,-76 Z" fill="#6e452c"/>
    <path d="M-26,-14 L26,-14 L25,-28 L-25,-28 Z" fill="#4a2e1d"/>`,
  sleeping: `<ellipse cx="0" cy="10" rx="42" ry="7" fill="#0f5c8c" opacity="0.5"/>
    <path d="M-30,-18 C-28,-58 -12,-86 10,-92 C26,-96 40,-88 42,-76 C43,-68 38,-62 30,-62 C28,-48 27,-32 26,-18 Z" fill="#3f6fb5"/>
    <rect x="-36" y="-20" width="66" height="18" rx="9" fill="#f4f6f8"/>
    <circle cx="46" cy="-70" r="10" fill="#f4f6f8"/>`,
  miner: `<ellipse cx="0" cy="10" rx="56" ry="8" fill="#0f5c8c" opacity="0.5"/>
    <path d="M-46,-12 A46,46 0 0 1 46,-12 Z" fill="#f2c230"/>
    <path d="M18,-12 C20,-38 32,-50 46,-12 Z" fill="#ddb022"/>
    <path d="M-7,-12 L-7,-55 Q0,-58 7,-55 L7,-12 Z" fill="#f7d354"/>
    <rect x="-56" y="-12" width="112" height="10" rx="5" fill="#d0a019"/>
    <rect x="-8" y="-46" width="16" height="10" rx="3" fill="#6b7280"/>
    <circle cx="0" cy="-30" r="12" fill="#6b7280"/>
    <circle cx="0" cy="-30" r="7" fill="#fff7c0"/>
    <circle cx="0" cy="-30" r="3" fill="#ffffff"/>
    <circle cx="-30" cy="-20" r="2.5" fill="#d0a019"/>
    <circle cx="30" cy="-20" r="2.5" fill="#d0a019"/>`,
  santa: `<ellipse cx="0" cy="10" rx="48" ry="7" fill="#0f5c8c" opacity="0.5"/>
    <path d="M32,-20 C32,-58 16,-86 -10,-92 C-28,-96 -44,-88 -44,-74 C-44,-64 -36,-58 -28,-60 C-34,-50 -30,-34 -28,-20 Z" fill="#c0392b"/>
    <path d="M-28,-60 C-36,-58 -44,-64 -44,-74 C-44,-82 -38,-88 -30,-90 C-38,-84 -40,-76 -36,-70 C-33,-65 -30,-62 -28,-60 Z" fill="#a93226"/>
    <rect x="-44" y="-22" width="88" height="20" rx="10" fill="#f4f6f8"/>
    <circle cx="-46" cy="-72" r="12" fill="#f4f6f8"/>`
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
