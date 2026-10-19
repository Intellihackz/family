# family on pons

A Chrome extension that adds a holder-only chat room to every token page on the [ponsfamily](https://ponsfamily.com) launchpad. If you hold the token you are in the room. If you do not, you see that it is locked and how many holders are inside.

Independent community project, not affiliated with pons.

## How it works

- The extension reads the token contract address from the page URL (`/launchpad/<address>`) and uses it as the room id.
- It follows the wallet the user already connected on the site (read from the site's wagmi state in localStorage), so there is no second connect flow.
- A small backend checks the balance on chain (`balanceOf`), tags the token's dev, counts holders, and serves the chat.
- The panel lives in a shadow DOM, follows the site's light and dark theme, and collapses to the logo button.

Known limit: wallet ownership is not verified with a signature, so a room can be entered by claiming a holder's public address.

## Layout

```
src/            extension (content script, background worker, panel)
  core/         wallet, theme, token and room logic, no UI
  shell/        the floating panel
  theme.ts      all colors, fonts and branding in one file
server/         Hono + viem backend (holder checks, chat)
assets/         logo mark (source of truth)
brand/          generated brand kit (logo, X, web)
scripts/        icon and brand kit generators
landing/        static landing page (plain HTML and CSS, no build step)
```

## Run locally

```bash
npm install && npm run build          # extension into dist/
cd server && npm install && npm run dev   # backend on :8787
```

Load `dist/` at `chrome://extensions` (Developer mode, Load unpacked), then open a token page on ponsfamily.

## Deploy the backend on Railway

1. Create a Railway project from this GitHub repo and set the service **Root Directory** to `/server`. Railway builds with `npm run build` and starts with `npm start`; `server/railway.json` sets the health check.
2. Add a **Volume** to the service, mounted at `/data`.
3. Set variables (see `server/.env.example`):

| Variable | Purpose |
| --- | --- |
| `DATA_DIR` | Set to `/data` so chat history lives on the volume |
| `RPC_URL` | Robinhood Chain RPC. The public one is rate limited, use a provider key |
| `ADMIN_KEY` | Enables moderator delete. Leave unset to disable |
| `PONS_API` | Launchpad API for dev and bonding curve lookup (default `https://ponsfamily.com`) |

4. Generate a public domain for the service and check `https://<domain>/health`.

The chat store is a single JSON file, so run one instance only.

## Release the alpha

```bash
npm run pack
```

Builds against the production server (override with `FAMILY_API=...`), strips source maps, and writes `landing/family-alpha.zip`. The landing page links to that file, so commit and push it to publish a new build. Bump `version` and `version_name` in `src/manifest.mjs` first. The API URL must be https.

Until the extension is on the Chrome Web Store, people install the zip by hand through Developer mode. The landing page walks them through it.

## Landing page

`landing/` is a static site with self-hosted fonts: set the Root Directory to `/landing` and leave build and install commands empty. It includes the alpha download, install steps and a light/dark toggle that remembers the visitor's choice. Before launch, set the absolute URL of `assets/og-image.png` in the `og:image` tag so link previews work.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build` / `watch` | Bundle the extension (targets localhost) |
| `npm run pack` | Build the release zip into `landing/` |
| `npm run icons` | Render toolbar icons from `assets/mark.svg` |
| `npm run brand` | Rebuild the brand kit in `brand/` |
| `npm run typecheck` | Typecheck the extension (also in `server/`) |
