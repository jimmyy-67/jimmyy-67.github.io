/* Banner de SNHardcorePlus (2000x650): identidad roja plana, título
 * MojangCraft (cufonfonts) con sombra dura, regla y textos inferiores en
 * Mojang (dafont) con separación de palabras vía tspans dx (este librsvg
 * ignora word-spacing). Render local con sharp; solo se commitea el PNG. */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const W = 2000;
const H = 650;
const T = "mojangcraft";
const B = "mojang";
const OUT =
  process.env.OUT ||
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "img", "mods", "snhardcoreplus-v2.png");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#f0403c"/>
  <text x="${W / 2 + 8}" y="268" font-family="${T}" font-size="124" fill="#a32014" text-anchor="middle">SNHARDCOREPLUS</text>
  <text x="${W / 2}" y="260" font-family="${T}" font-size="124" fill="#ffffff" text-anchor="middle">SNHARDCOREPLUS</text>
  <rect x="${W / 2 - 300}" y="318" width="600" height="4" fill="#ffffff" opacity="0.85"/>
  <text x="${W / 2}" y="412" font-family="${B}" font-size="52" fill="#ffffff" text-anchor="middle">BepInEx Port</text>
  <text x="${W / 2}" y="502" font-family="${B}" font-size="38" fill="#ffd9d4" text-anchor="middle">by<tspan dx="18">qopp,</tspan><tspan dx="18">fully</tspan><tspan dx="18">configurable,</tspan><tspan dx="18">hardcore</tspan><tspan dx="18">survival</tspan></text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(OUT);
console.log("sn banner ->", OUT);
