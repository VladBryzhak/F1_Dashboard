// The barrier boards' texture for scene.py: our own "PADDOCK TIMES" board,
// written to <DATA_DIR>/banner.png.  tsx banner.ts DATA_DIR
import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import path from "path";

const FONT_DIR = path.resolve(__dirname, "../../server/assets/fonts");
const fontFiles = fs.readdirSync(FONT_DIR).filter((f) => f.endsWith(".ttf")).map((f) => path.join(FONT_DIR, f));
const W = 1536, H = 128;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#14131a"/>
<rect x="0" y="0" width="${W}" height="10" fill="#e10600"/>
<g font-family="Fira Sans Extra Condensed" font-weight="800">
${[0, 1].map((k) => {
  const x = 80 + k * 768;
  return `<rect x="${x}" y="30" width="80" height="80" rx="12" fill="#e10600"/>
  <text x="${x + 40}" y="92" font-size="52" fill="#fff" text-anchor="middle">PT</text>
  <text x="${x + 110}" y="96" font-size="70" fill="#f3f2f6">PADDOCK TIMES</text>`;
}).join("")}
</g></svg>`;
const out = path.join(process.argv[2], "banner.png");
fs.writeFileSync(out, new Resvg(svg, { font: { fontFiles, loadSystemFonts: false } }).render().asPng());
console.log(out);
