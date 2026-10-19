import { API } from "./config.mjs";

// Launchpad host. Token pages live at /launchpad/<contract address>.
export const HOSTS = ["https://*.ponsfamily.com/*", "https://ponsfamily.com/*"];

export const manifest = {
  manifest_version: 3,
  name: "family on pons",
  version: "0.1.2",
  version_name: "0.1.2 alpha",
  description: "A community chat on every token page. Hold the token to join. Community built, not affiliated with pons.",
  icons: { 16: "icons/16.png", 32: "icons/32.png", 48: "icons/48.png", 128: "icons/128.png" },
  action: { default_title: "family on pons", default_icon: { 16: "icons/16.png", 32: "icons/32.png", 48: "icons/48.png", 128: "icons/128.png" } },
  background: { service_worker: "background.js" },
  host_permissions: [`${API}/*`],
  content_scripts: [
    { matches: HOSTS, js: ["content.js"], run_at: "document_idle" },
  ],
};
