import { build, context } from "esbuild";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { manifest } from "./src/manifest.mjs";

const watch = process.argv.includes("--watch");
mkdirSync("dist", { recursive: true });
writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 2));
cpSync("public", "dist", { recursive: true });

const opts = {
  entryPoints: { content: "src/content.ts", background: "src/background.ts" },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome120",
  loader: { ".svg": "text" },
  define: { "process.env.FAMILY_API": JSON.stringify(process.env.FAMILY_API ?? "") },
  sourcemap: true,
  logLevel: "info",
};

if (watch) await (await context(opts)).watch();
else await build(opts);
