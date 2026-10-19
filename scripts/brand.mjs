// Builds the downloadable brand kit into brand/. Run: npm run brand
// The wordmark is converted to outlines (Nunito, SIL OFL) so every SVG is font-independent.
import { Resvg } from "@resvg/resvg-js";
import ot from "opentype.js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const INK = "#0c1500", PAPER = "#fdfef9", LIGHT_BG = "#f5f5f7", DARK_BG = "#0b0b0b";
const THEMES = {
  light: { bg: LIGHT_BG, fg: INK, muted: "rgba(12,21,0,0.55)" },
  dark: { bg: DARK_BG, fg: PAPER, muted: "rgba(253,254,249,0.6)" },
};

const loadFont = (w) => {
  const b = readFileSync(`node_modules/@fontsource/nunito/files/nunito-latin-${w}-normal.woff`);
  return ot.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const bold = loadFont(800), semi = loadFont(600);

const raw = readFileSync("assets/mark.svg", "utf8");
const inner = raw.replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>[\s\S]*?<\/title>/, "");
const markAt = (x, y, size) => `<g transform="translate(${x} ${y}) scale(${size / 128})">${inner}</g>`;
// Manual glyph layout: opentype.js 2.0's shaper fails on Nunito's GSUB tables, and two plain Latin words need no shaping.
function layout(font, str, x, y, size) {
  const k = size / font.unitsPerEm;
  let pen = x, prev = null, d = "";
  for (const ch of str) {
    const g = font.charToGlyph(ch);
    if (prev) { try { pen += font.getKerningValue(prev, g) * k; } catch { /* no kerning data */ } }
    d += g.getPath(pen, y, size).toPathData(2);
    pen += g.advanceWidth * k;
    prev = g;
  }
  return { d, width: pen - x };
}
const width = (font, str, size) => layout(font, str, 0, 0, size).width;
const text = (font, str, x, y, size, fill) => `<path d="${layout(font, str, x, y, size).d}" fill="${fill}"/>`;

/** Horizontal lockup: mark, "family", divider, "on pons". Returns its own coordinate box. */
function lockup(t) {
  const MARK = 132, BASE = 91, FAM = 96, TAG = 36;
  const famW = width(bold, "family", FAM);
  const x0 = 102; // the F's visible right edge is ~80 after the shift below, plus a gap
  const divX = x0 + famW + 30;
  const tagX = divX + 26;
  const w = tagX + width(semi, "on pons", TAG);
  const body =
    markAt(-26, 0, MARK) +
    text(bold, "family", x0, BASE, FAM, t.fg) +
    `<rect x="${divX}" y="${BASE - 46}" width="3" height="42" rx="1.5" fill="${t.muted}"/>` +
    text(semi, "on pons", tagX, BASE, TAG, t.muted);
  return { body, w, h: 132 };
}

const svgDoc = (w, h, body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}${body}</svg>\n`;
const png = (svg, width) => new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
const out = (path, data) => { writeFileSync(`brand/${path}`, data); console.log(path); };

for (const d of ["logo", "x", "web"]) mkdirSync(`brand/${d}`, { recursive: true });

// 1. Logo: the F on its own, transparent, tightly cropped square
const markSvg = svgDoc(112, 112, `<g transform="translate(-8 -8)">${inner}</g>`);
out("logo/mark.svg", markSvg);
out("logo/mark-512.png", png(markSvg, 512));
out("logo/mark-1024.png", png(markSvg, 1024));

// 2. Lockups, transparent, for light and dark surfaces
for (const [name, t] of Object.entries(THEMES)) {
  const l = lockup(t), pad = 16;
  const svg = svgDoc(l.w + pad * 2, l.h + pad * 2, `<g transform="translate(${pad} ${pad})">${l.body}</g>`);
  out(`logo/lockup-for-${name}-bg.svg`, svg);
  out(`logo/lockup-for-${name}-bg.png`, png(svg, 1600));
}

// 3. X: profile picture (circle-cropped, so the F stays well inside) and 1500x500 banner
for (const [name, t] of Object.entries(THEMES)) {
  const S = 250;
  out(`x/profile-400-${name}.png`, png(svgDoc(400, 400, markAt(200 - S / 2, 200 - S / 2, S), t.bg), 400));
  const l = lockup(t), k = 880 / l.w;
  out(`x/banner-1500x500-${name}.png`, png(svgDoc(1500, 500, `<g transform="translate(${750 - (l.w * k) / 2} ${250 - (l.h * k) / 2}) scale(${k})">${l.body}</g>`, t.bg), 1500));
}

// 4. Web: favicon, link-preview image
const fav = svgDoc(112, 112, `<g transform="translate(-8 -8)">${inner}</g>`);
out("web/favicon.svg", fav);
out("web/favicon-32.png", png(fav, 32));
out("web/favicon-192.png", png(fav, 192));
{
  const t = THEMES.light, l = lockup(t), k = 760 / l.w, tagline = "the community chat for every token";
  const tw = width(semi, tagline, 38);
  const body = `<g transform="translate(${600 - (l.w * k) / 2} 200) scale(${k})">${l.body}</g>` + text(semi, tagline, 600 - tw / 2, 420, 38, t.muted);
  out("web/og-image-1200x630.png", png(svgDoc(1200, 630, body, t.bg), 1200));
}

writeFileSync("brand/README.txt", `family on pons: brand kit

LOGO
  logo/mark.svg                  the glass F, transparent. Master file.
  logo/mark-512.png, -1024.png   same, as PNG
  logo/lockup-for-light-bg.*     mark + "family | on pons", dark text, for light surfaces
  logo/lockup-for-dark-bg.*      same, light text, for dark surfaces

X (TWITTER)
  x/profile-400-light|dark.png   400x400 profile picture. X crops it to a circle; the F sits inside the safe area.
  x/banner-1500x500-light|dark.png   header image. Keep it centered: the profile picture overlaps the bottom left.

WEB
  web/favicon.svg, favicon-32.png, favicon-192.png
  web/og-image-1200x630.png      link preview image for the landing page

COLORS
  Ink          #0c1500
  Paper        #fdfef9
  Green        #00c805
  Light bg     #f5f5f7
  Dark bg      #0b0b0b
  Glass rim    #8fcfa4 to #2a6544

TYPE
  Nunito ExtraBold (family) and SemiBold (on pons), SIL Open Font License. Already outlined in the SVGs.

NOTE
  This is an independent community product. Keep the line "community built, not affiliated with pons"
  wherever the brand appears, and do not use the pons mark.
`);
console.log("README.txt");
