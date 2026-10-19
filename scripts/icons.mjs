// Renders assets/mark.svg to the PNG sizes Chrome needs. Run: npm run icons
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("assets/mark.svg", "utf8");
for (const size of [16, 32, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(`public/icons/${size}.png`, png);
  console.log(`icons/${size}.png`);
}
