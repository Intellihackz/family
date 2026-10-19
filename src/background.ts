// Service worker: makes the backend calls so the page's origin, CSP and mixed-content rules never apply.
import { API } from "./config.mjs";

export type Msg =
  | { type: "holder"; token: string; address: string }
  | { type: "holders"; token: string }
  | { type: "poll"; token: string; address: string; after: number }
  | { type: "send"; token: string; address: string; text: string };

async function call(path: string, init?: RequestInit) {
  const r = await fetch(`${API}${path}`, init);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? `http_${r.status}`);
  return j;
}

function run(m: Msg) {
  switch (m.type) {
    case "holder": return call(`/holder?token=${m.token}&address=${m.address}`);
    case "holders": return call(`/holders?token=${m.token}`);
    case "poll": return call(`/rooms/${m.token}/messages?address=${m.address}&after=${m.after}`);
    case "send":
      return call(`/rooms/${m.token}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: m.address, text: m.text }) });
  }
}

chrome.runtime.onMessage.addListener((m: Msg, _sender, send) => {
  run(m).then((data) => send({ ok: true, data }), (e) => send({ ok: false, error: String(e?.message ?? e) }));
  return true; // async response
});
