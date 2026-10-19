// Builds the X (Twitter) page images into brand/x/. Run: npm run x
// Profile on white, a banner that shows the product, and a post image of the panel.
// Text is outlined with Nunito (SIL OFL) so renders do not depend on installed fonts.
import { Resvg } from "@resvg/resvg-js";
import ot from "opentype.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const INK = "#0c1500", GREEN = "#00c805", GREEN_TEXT = "#008a06", MUTED = "#6b7360", LINE = "#dcdfd6", SURFACE = "#f5f5f7", WHITE = "#ffffff";

const font = (w) => {
  const b = readFileSync(`node_modules/@fontsource/nunito/files/nunito-latin-${w}-normal.woff`);
  return ot.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const F = { 600: font(600), 700: font(700), 800: font(800) };

// opentype.js's toPathData() can emit NaN coordinates for some glyphs at some pen positions
// (it dropped the tail of "Only", "thanks", "affiliated"). The raw commands are fine, so serialize them here.
const toD = (cmds) => cmds.map((c) => c.type === "Z" ? "Z" : c.type + [c.x1, c.y1, c.x2, c.y2, c.x, c.y].filter((v) => v !== undefined).map((v) => (+v).toFixed(2)).join(" ")).join("");

// Manual layout: opentype.js 2.0's shaper fails on Nunito's GSUB tables, and short Latin strings need no shaping.
function layout(f, str, x, y, size) {
  const k = size / f.unitsPerEm;
  let pen = x, prev = null, d = "";
  for (const ch of str) {
    const g = f.charToGlyph(ch);
    if (prev) { try { pen += f.getKerningValue(prev, g) * k; } catch { /* no kerning */ } }
    d += toD(g.getPath(pen, y, size).commands);
    pen += g.advanceWidth * k;
    prev = g;
  }
  return { d, width: pen - x };
}
const w = (weight, str, size) => layout(F[weight], str, 0, 0, size).width;
const text = (weight, str, x, y, size, fill, anchor = "start") => {
  const width = w(weight, str, size);
  const x0 = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
  return `<path d="${layout(F[weight], str, x0, y, size).d}" fill="${fill}"/>`;
};

const markInner = readFileSync("assets/mark.svg", "utf8").replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>[\s\S]*?<\/title>/, "");
// The art sits inside a 128 box with padding; crop to the F so "size" means the visible letter.
const mark = (x, y, size) => `<g transform="translate(${x} ${y}) scale(${size / 110}) translate(-9 -9)">${markInner}</g>`;

const hsl = (h, s, l) => {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/** The product: a replica of the in-page panel, 330 wide. Returns { svg, h }. */
function panel() {
  const W = 330, H = 358;
  let s = "";
  s += `<clipPath id="pc"><rect width="${W}" height="${H}" rx="24"/></clipPath>`;
  s += `<rect width="${W}" height="${H}" rx="24" fill="${WHITE}"/>`;
  s += `<g clip-path="url(#pc)"><rect width="${W}" height="46" fill="${SURFACE}"/><rect y="46" width="${W}" height="1" fill="${LINE}"/></g>`;
  s += `<rect width="${W}" height="${H}" rx="24" fill="none" stroke="${LINE}"/>`;
  // header
  s += mark(14, 11, 24);
  s += `<circle cx="36" cy="33" r="4.5" fill="${GREEN}" stroke="${SURFACE}" stroke-width="2"/>`;
  s += text(800, "family", 50, 29, 15, INK);
  const fw = w(800, "family", 15);
  s += `<rect x="${50 + fw + 8}" y="17" width="1" height="14" fill="${LINE}"/>`;
  s += text(600, "on pons", 50 + fw + 17, 28.5, 11, MUTED);
  s += `<rect x="298" y="23" width="14" height="2" rx="1" fill="${MUTED}"/>`;
  // wallet chip + supply badge
  const chip = "MetaMask 0x29cb…7141", cw = w(600, chip, 11.5) + 32;
  s += `<rect x="14" y="60" width="${cw}" height="22" rx="11" fill="${SURFACE}" stroke="${LINE}"/>`;
  s += `<circle cx="27" cy="71" r="4" fill="${hsl(330, 55, 36)}"/>`;
  s += text(600, chip, 37, 75, 11.5, INK);
  const badge = "0.907% of supply", bw = w(700, badge, 11.5) + 20;
  s += `<rect x="14" y="90" width="${bw}" height="22" rx="11" fill="${GREEN}" fill-opacity=".14" stroke="${GREEN}" stroke-opacity=".4"/>`;
  s += text(700, badge, 24, 105, 11.5, GREEN_TEXT);
  s += text(600, "5 members", 14 + bw + 10, 105, 12, MUTED);
  // messages
  const msgs = [
    { who: "0x2b3d…fb5e", c: hsl(150, 55, 36), pct: "2.1%", t: "02:37 PM", body: "gm family, anyone watching the curve?" },
    { who: "0xd3de…cd20", c: hsl(290, 55, 36), pct: "0.000%", t: "02:41 PM", dev: true, body: "next update ships this week" },
    { who: "you", c: hsl(330, 55, 36), pct: "0.907%", t: "02:44 PM", me: true, body: "holding. thanks for the update" },
  ];
  msgs.forEach((m, i) => {
    const y = 126 + i * 46;
    if (m.me) s += `<rect x="8" y="${y}" width="${W - 16}" height="42" rx="10" fill="${GREEN}" fill-opacity=".11"/>`;
    s += text(700, m.who, 16, y + 15, 11, m.c);
    let x = 16 + w(700, m.who, 11) + 6;
    if (m.dev) {
      const dw = w(800, "dev", 10) + 14;
      s += `<rect x="${x}" y="${y + 4}" width="${dw}" height="15" rx="7.5" fill="${GREEN}"/>` + text(800, "dev", x + 7, y + 15, 10, INK);
      x += dw + 6;
    }
    s += text(600, m.pct, x, y + 15, 11, MUTED);
    s += text(600, m.t, W - 16, y + 15, 11, MUTED, "end");
    s += text(600, m.body, 16, y + 34, 13, INK);
  });
  // composer
  s += `<rect x="14" y="274" width="258" height="36" rx="18" fill="${SURFACE}" stroke="${LINE}"/>`;
  s += text(600, "Message the family", 30, 296, 13, MUTED);
  s += `<circle cx="298" cy="292" r="18" fill="${GREEN}"/><path d="M291 292h13M299 286l6 6-6 6" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<rect y="326" width="${W}" height="1" fill="${LINE}"/>`;
  s += text(600, "community built, not affiliated with pons", 16, 346, 10.5, MUTED);
  return { svg: s, W, H };
}

const shadowDefs = `<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="16"/></filter><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>`;
const glow = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${GREEN}" fill-opacity=".20" filter="url(#soft)"/>`;
const panelAt = (x, y, k) => {
  const p = panel();
  return `<g transform="translate(${x} ${y + 14 * k}) scale(${k})"><rect width="${p.W}" height="${p.H}" rx="24" fill="#0c1500" fill-opacity=".16" filter="url(#sh)"/></g>` +
         `<g transform="translate(${x} ${y}) scale(${k})">${p.svg}</g>`;
};

const doc = (W, H, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${shadowDefs}</defs><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;
const png = (svg, width) => new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
const out = (name, data) => { writeFileSync(`brand/x/${name}`, data); console.log(name); };
mkdirSync("brand/x", { recursive: true });

// 1. Profile picture: the F on pure white. X crops to a circle, so keep it well inside.
{
  const S = 232, doc400 = doc(400, 400, mark(200 - S / 2, 200 - S / 2, S), WHITE);
  out("profile-white-400.png", png(doc400, 400));
  out("profile-white-800.png", png(doc400, 800));
}

// 2. Banner 1500x500. The profile picture covers the bottom left and phones crop the edges,
//    so the message sits center and the product on the right.
{
  const body =
    glow(1190, 250, 330, 200) +
    text(800, "Every token", 430, 200, 68, INK) +
    text(800, "has a community.", 430, 275, 68, INK) +
    text(700, "Hold the token to join the chat.", 432, 332, 30, GREEN_TEXT) +
    panelAt(1060, 62, 1.0);
  out("banner-1500x500.png", png(doc(1500, 500, body, SURFACE), 1500));
}

// 3. Image for the pinned post, 16:9
{
  const k = 2.0, p = panel();
  const body = glow(800, 450, 420, 330) + panelAt(800 - (p.W * k) / 2, 450 - (p.H * k) / 2, k);
  out("post-1600x900.png", png(doc(1600, 900, body, SURFACE), 1600));
}
