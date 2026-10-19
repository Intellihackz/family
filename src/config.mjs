// Backend URL. Set FAMILY_API when building for release, e.g. FAMILY_API=https://family.up.railway.app npm run build
// Must be https in production: Chrome blocks plain http calls from pages on https sites.
export const API = process.env.FAMILY_API || "http://localhost:8787";
