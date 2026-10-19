// Builds the release zip into landing/ and points the landing page at it. Run: npm run pack
// The version is in the filename on purpose: the host serves files with "cache for a year, never revalidate",
// so a fixed name like family-alpha.zip keeps handing people the old build after an update.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { manifest } from "../src/manifest.mjs";

const v = manifest.version;
const name = `family-alpha-${v}.zip`;

execSync("npm run build", { stdio: "inherit" });
for (const f of readdirSync("landing")) if (/^family-alpha.*\.zip$/.test(f)) rmSync(`landing/${f}`);
execSync(`zip -qr ../landing/${name} . -x "*.map"`, { cwd: "dist" });

let html = readFileSync("landing/index.html", "utf8");
const links = html.match(/href="family-alpha[^"]*\.zip"/g)?.length ?? 0;
const labels = html.match(/Download alpha <em>v[\d.]+<\/em>/g)?.length ?? 0;
if (!links || !labels) throw new Error(`landing/index.html: expected download links and version labels, found ${links} and ${labels}`);
html = html.replace(/href="family-alpha[^"]*\.zip"/g, `href="${name}"`).replace(/(Download alpha <em>)v[\d.]+(<\/em>)/g, `$1v${v}$2`);
writeFileSync("landing/index.html", html);
console.log(`landing/${name}  (${links} links, ${labels} labels updated)`);
