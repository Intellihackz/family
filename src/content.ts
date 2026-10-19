import { watchSiteWallet, type SiteWallet } from "./core/siteWallet";
import { watchLocation } from "./core/location";
import { checkHolder, holderCount, pollMessages, sendMessage } from "./core/room";
import { tokenFromLocation } from "./core/token";
import { mountPanel } from "./shell/panel";

const RECHECK_MS = 30_000; // sell and lose access: the balance is rechecked on this interval

// Both follow the page: the site is a single-page app, so the URL and the wallet can change without a reload.
let token: string | null = tokenFromLocation();
let current: SiteWallet | null = null;
let recheck: ReturnType<typeof setInterval> | undefined;
let chatGen = 0; // bumping this stops the running poll loop
let chatFor = ""; // "<token>:<address>" the loop is serving
let seen = 0;

const panel = mountPanel(async (text) => {
  if (!token || !current) throw new Error("no_wallet");
  const msg = await sendMessage(token, current.address, text);
  panel.addMessages([msg]); // show our own message at once; the poll skips ids we already hold
  seen = Math.max(seen, msg.id);
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stale = (tk: string, wallet: SiteWallet) => token !== tk || current?.address !== wallet.address;

async function chatLoop(tk: string, wallet: SiteWallet) {
  const gen = ++chatGen;
  chatFor = `${tk}:${wallet.address}`;
  let after = 0;
  seen = 0;
  while (gen === chatGen) {
    try {
      const r = await pollMessages(tk, wallet.address, after);
      if (gen !== chatGen) return;
      const fresh = r.messages.filter((m) => m.id > seen);
      if (fresh.length || after === 0) panel.addMessages(fresh, after === 0);
      seen = Math.max(seen, r.last);
      after = r.last;
    } catch (e: any) {
      if (gen !== chatGen) return;
      if (e?.message === "not_holder") { chatFor = ""; return void evaluate(tk, wallet, false); }
      await sleep(3000); // server hiccup: back off, then retry
    }
  }
}

function stopChat() { chatGen++; chatFor = ""; }

async function evaluate(tk: string, wallet: SiteWallet, first: boolean) {
  if (first) panel.render({ kind: "checking", token: tk, wallet });
  // Holder count is a nice-to-have, so a failure there must not break the gate.
  const [info, holders] = await Promise.all([
    checkHolder(tk, wallet.address).catch((e: Error) => e),
    holderCount(tk).catch(() => undefined),
  ]);
  if (stale(tk, wallet)) return; // page or wallet changed while we were waiting
  if (info instanceof Error) return panel.render({ kind: "error", token: tk, wallet, message: "Could not check your balance. Retrying." });
  if (!info.isHolder && !info.isDev) { stopChat(); return panel.render({ kind: "locked", token: tk, wallet, holders }); }
  panel.render({ kind: "holder", token: tk, wallet, holding: { balance: info.balance, supply: info.supply, pct: info.pct }, isDev: info.isDev, holders });
  if (chatFor !== `${tk}:${wallet.address}`) chatLoop(tk, wallet);
}

/** Rebuild everything for the current page and wallet. Runs on load and on every change of either. */
async function refresh() {
  clearInterval(recheck);
  stopChat();
  const tk = token, wallet = current;
  if (!tk) return panel.render({ kind: "no-token" });
  if (!wallet) {
    panel.render({ kind: "no-wallet", token: tk });
    holderCount(tk).then((holders) => token === tk && !current && panel.render({ kind: "no-wallet", token: tk, holders })).catch(() => {});
    return;
  }
  await evaluate(tk, wallet, true);
  if (!stale(tk, wallet)) recheck = setInterval(() => evaluate(tk, wallet, false), RECHECK_MS);
}

// The site owns wallet connection. We follow it and gate on the on-chain balance.
watchSiteWallet((wallet) => { current = wallet; refresh(); });

// Follow page changes: into a token page, out of one, or from one token to another.
watchLocation(() => {
  const next = tokenFromLocation();
  if (next === token) return;
  token = next;
  refresh();
});
