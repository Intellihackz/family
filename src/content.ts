import { watchSiteWallet, type SiteWallet } from "./core/siteWallet";
import { checkHolder, holderCount, pollMessages, sendMessage } from "./core/room";
import { tokenFromLocation } from "./core/token";
import { mountPanel } from "./shell/panel";

const RECHECK_MS = 30_000; // sell and lose access: the balance is rechecked on this interval

const token = tokenFromLocation();
let current: SiteWallet | null = null;
let recheck: ReturnType<typeof setInterval> | undefined;
let chatGen = 0; // bumping this stops the running poll loop
let chatFor = "";

const panel = mountPanel(async (text) => {
  if (!token || !current) throw new Error("no_wallet");
  const msg = await sendMessage(token, current.address, text);
  panel.addMessages([msg]); // show our own message at once; the poll skips ids we already hold
  seen = Math.max(seen, msg.id);
});
let seen = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chatLoop(wallet: SiteWallet) {
  const gen = ++chatGen;
  chatFor = wallet.address;
  let after = 0;
  seen = 0;
  while (gen === chatGen && token) {
    try {
      const r = await pollMessages(token, wallet.address, after);
      if (gen !== chatGen) return;
      const fresh = r.messages.filter((m) => m.id > seen);
      if (fresh.length || after === 0) panel.addMessages(fresh, after === 0);
      seen = Math.max(seen, r.last);
      after = r.last;
    } catch (e: any) {
      if (gen !== chatGen) return;
      if (e?.message === "not_holder") { chatFor = ""; return void evaluate(wallet, false); }
      await sleep(3000); // server hiccup: back off, then retry
    }
  }
}

function stopChat() { chatGen++; chatFor = ""; }

async function evaluate(wallet: SiteWallet, first: boolean) {
  if (!token) return;
  if (first) panel.render({ kind: "checking", token, wallet });
  // Holder count is a nice-to-have, so a failure there must not break the gate.
  const [info, holders] = await Promise.all([
    checkHolder(token, wallet.address).catch((e: Error) => e),
    holderCount(token).catch(() => undefined),
  ]);
  if (current?.address !== wallet.address) return; // wallet changed while we were waiting
  if (info instanceof Error) return panel.render({ kind: "error", token, wallet, message: "Could not check your balance. Retrying." });
  if (!info.isHolder && !info.isDev) { stopChat(); return panel.render({ kind: "locked", token, wallet, holders }); }
  panel.render({ kind: "holder", token, wallet, holding: { balance: info.balance, supply: info.supply, pct: info.pct }, isDev: info.isDev, holders });
  if (chatFor !== wallet.address) chatLoop(wallet);
}

// The site owns wallet connection. We follow it and gate on the on-chain balance.
watchSiteWallet(async (wallet) => {
  current = wallet;
  clearInterval(recheck);
  stopChat();
  if (!token) return panel.render({ kind: "no-token" });
  if (!wallet) {
    panel.render({ kind: "no-wallet", token });
    holderCount(token).then((holders) => !current && panel.render({ kind: "no-wallet", token, holders })).catch(() => {});
    return;
  }
  await evaluate(wallet, true);
  recheck = setInterval(() => evaluate(wallet, false), RECHECK_MS);
});
