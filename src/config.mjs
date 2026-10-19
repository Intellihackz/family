// Backend URL. Production by default, so a plain build is always safe to load and share.
// For local server work: FAMILY_API=http://localhost:8787 npm run dev
// Must be https in production: Chrome blocks plain http calls from pages on https sites.
export const API = process.env.FAMILY_API || "https://family-production-e140.up.railway.app";
