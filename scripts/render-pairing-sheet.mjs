/* Hoja de pairings tipográficos para el banner de Hoverfish Hats:
 * título siempre en Megazoid; cada panel prueba una candidata para los
 * textos de abajo (subtítulo, crédito y lista de hats). */
import sharp from "sharp";

const W = 2000;
const PANEL = 300;
const TITLE_FONT = process.env.TITLE_FONT || "Megazoid";
const OUT = process.env.OUT || "debug/pairing-sheet.png";

const panels = [
  { tag: "A", fam: "Chakra Petch", w: 600, note: "CHAKRA PETCH · SEMIBOLD" },
  { tag: "B", fam: "Rajdhani", w: 600, note: "RAJDHANI · SEMIBOLD" },
  { tag: "C", fam: "Poppins", w: 600, note: "POPPINS · SEMIBOLD" },
  { tag: "D", fam: "Space Grotesk", w: 500, note: "SPACE GROTESK · MEDIUM" },
  { tag: "E", fam: "Mojang", w: 400, note: "MOJANG · ACTUAL (REFERENCIA)" }
];

const body = panels
  .map((p, i) => {
    const y = i * PANEL;
    const isMojang = p.fam === "Mojang";
    const ws1 = isMojang ? ' word-spacing="14"' : "";
    const ws2 = isMojang ? ' word-spacing="12"' : "";
    const ls3 = isMojang ? ' word-spacing="8"' : ' letter-spacing="3"';
    const hatsLine = isMojang
      ? "top hat · mexican · cowboy · sleeping cap · miner helmet · santa"
      : "TOP HAT · MEXICAN · COWBOY · SLEEPING CAP · MINER HELMET · SANTA";
    return `
  <g transform="translate(0 ${y})">
    ${i > 0 ? `<rect x="0" y="-3" width="${W}" height="3" fill="#0f5c8c"/>` : ""}
    <rect x="0" y="0" width="${W}" height="${PANEL}" fill="#1e88c7"/>
    <text x="60" y="46" font-family="Space Mono" font-size="22" fill="#bfe0f5" letter-spacing="2">${p.tag} · ${p.note}</text>
    <text x="${W / 2 + 6}" y="138" font-family="${TITLE_FONT}" font-size="84" fill="#0f5c8c" text-anchor="middle">HOVERFISH HATS</text>
    <text x="${W / 2}" y="132" font-family="${TITLE_FONT}" font-size="84" fill="#ffffff" text-anchor="middle">HOVERFISH HATS</text>
    <rect x="${W / 2 - 240}" y="162" width="480" height="3" fill="#ffffff" opacity="0.85"/>
    <text x="${W / 2}" y="216" font-family="${p.fam}" font-weight="${p.w}" font-size="40" fill="#ffffff" text-anchor="middle"${ws1}>6 customizable hats for the Hoverfish</text>
    <text x="${W / 2}" y="258" font-family="${p.fam}" font-weight="${p.w}" font-size="29" fill="#cfe8f7" text-anchor="middle"${ws2}>by qopp · cosmetic mod · Subnautica</text>
    <text x="${W / 2}" y="290" font-family="${p.fam}" font-weight="${p.w}" font-size="19" fill="#bfe0f5" text-anchor="middle"${ls3}>${hatsLine}</text>
  </g>`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${PANEL * panels.length}">${body}</svg>`;
await sharp(Buffer.from(svg)).png().toFile(OUT);
console.log("sheet ->", OUT);
