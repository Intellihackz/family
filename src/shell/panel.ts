import { theme as t, cssVars } from "../theme";
import { watchSiteTheme } from "../core/siteTheme";
import markSvg from "../../assets/mark.svg";
import type { SiteWallet } from "../core/siteWallet";
import { isRobinhood, CHAIN } from "../core/chain";
import type { ChatMessage } from "../core/room";

export type Holding = { balance: string; supply: string; pct: number };

export type PanelState =
  | { kind: "no-token" }
  | { kind: "no-wallet"; token: string; holders?: number }
  | { kind: "checking"; token: string; wallet: SiteWallet }
  | { kind: "locked"; token: string; wallet: SiteWallet; holders?: number }
  | { kind: "holder"; token: string; wallet: SiteWallet; holding: Holding; isDev?: boolean; holders?: number }
  | { kind: "error"; token: string; wallet: SiteWallet; message: string };

export type Panel = {
  render(s: PanelState): void;
  /** Append chat messages. Pass reset to clear the log first (new room or new wallet). */
  addMessages(msgs: ChatMessage[], reset?: boolean): void;
  setChatNotice(text: string): void;
  /** Show the token's ticker in the header, or hide it with null. */
  setTicker(symbol: string | null): void;
};

const svg = (d: string, size = 16, sw = 1.6) =>
  `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  min: svg(`<path d="M3.5 8h9"/>`),
  send: svg(`<path d="M3 8h9.5M8.5 4l4 4-4 4"/>`),
  lock: svg(`<rect x="3.5" y="7" width="9" height="6.5" rx="1.8"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/>`, 22, 1.4),
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const hue = (a: string) => { let h = 0; for (const c of a.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const fmtPct = (p: number) => `${p.toFixed(p < 1 ? 3 : 1)}%`;
const MIN_KEY = "family:minimized";

/** The brand mark inline. Ids are prefixed per instance: gradients inside a display:none subtree
 *  (the hidden header while minimized) would otherwise break the visible copy. */
const logo = (p: string) =>
  markSvg.replace('viewBox="0 0 128 128"', 'viewBox="9 9 110 110"') // crop the canvas padding so the F fills its box
    .replace(/<title>[\s\S]*?<\/title>/, "").replace(/(id="|url\(#|href="#)(f|clip|body|rim|gloss|glow)(?=["\)])/g, `$1${p}-$2`);

const CSS = `
  :host{all:initial}
  *{box-sizing:border-box}
  .dock{${cssVars(t.palettes.light)}
    font:13px/1.45 ${t.font};color:var(--text);-webkit-font-smoothing:antialiased}
  .dock[data-theme=dark]{${cssVars(t.palettes.dark)}}
  button{all:unset;box-sizing:border-box;cursor:pointer}
  button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

  .dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex:none;transition:background .2s,box-shadow .2s}
  .dock[data-s=live] .dot{background:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
  .dock[data-s=warn] .dot{background:var(--warn)}

  /* minimized: the logo itself is the floating button */
  .logo{position:relative;display:inline-block;flex:none;width:30px;height:30px}
  .logo svg{display:block;width:100%;height:100%}
  .logo .dot{position:absolute;right:-4px;bottom:-3px;width:11px;height:11px;border:2px solid var(--bg)}
  .logo.sm{width:24px;height:24px}
  .logo.sm .dot{width:9px;height:9px;right:-3px;bottom:-2px;border-color:var(--surface)}
  .pill{display:none;position:relative;width:56px;height:56px;border-radius:50%;background:var(--bg);border:1px solid var(--border);
    box-shadow:var(--shadow);place-items:center;transition:border-color .15s,transform .15s}
  .pill:hover{border-color:color-mix(in srgb,var(--accent) 55%,var(--border));transform:translateY(-1px)}
  .unread{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--accent);color:var(--on-accent);font-size:11px;font-weight:700;display:grid;place-items:center}
  .unread[hidden]{display:none}
  .dock[data-min=true] .pill{display:grid}
  .dock[data-min=true] .card{display:none}

  /* card */
  .card{width:330px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--border);
    border-radius:${t.radius};overflow:hidden;box-shadow:var(--shadow);transform-origin:bottom right;animation:in .18s ease-out}
  @keyframes in{from{opacity:0;transform:translateY(6px) scale(.98)}}
  @media (prefers-reduced-motion:reduce){.card{animation:none}.pill,.dot{transition:none}}

  header{display:flex;align-items:center;gap:8px;padding:11px 12px 11px 14px;border-bottom:1px solid var(--border);background:var(--surface)}
  .mark{font-weight:700;font-size:15px;letter-spacing:-.02em}
  .tag{font-size:11px;color:var(--muted);padding-left:8px;border-left:1px solid var(--border)}
  .grow{flex:1;min-width:0}
  .ticker{max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:800;font-size:12px;color:var(--accent-text);
    background:color-mix(in srgb,var(--accent) 14%,transparent);border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);padding:2px 9px;border-radius:999px}
  .ticker[hidden]{display:none}
  .icon{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;color:var(--muted);transition:background .15s,color .15s}
  .icon:hover{background:var(--raised);color:var(--text)}

  main{padding:14px;display:flex;flex-direction:column;min-height:0}
  footer{padding:8px 14px;font-size:10.5px;color:var(--muted);border-top:1px solid var(--border)}
  .m{color:var(--muted)} .sm{font-size:12px}
  code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace}

  /* gate states */
  .gate{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:4px 0 2px}
  .lock{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--raised);border:1px solid var(--border);color:var(--accent-text);margin-bottom:6px}
  .gate h3{margin:0;font-size:15px;font-weight:700;letter-spacing:-.01em}
  .stat{margin-top:8px;display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:var(--surface);border:1px solid var(--border);font-size:12px}
  .stat b{font-variant-numeric:tabular-nums}
  .note{margin-top:6px;font-size:12px;color:var(--warn)}
  .skel{height:10px;border-radius:5px;background:linear-gradient(90deg,var(--surface),var(--raised),var(--surface));background-size:200% 100%;animation:sh 1.2s linear infinite}
  @keyframes sh{to{background-position:-200% 0}}

  /* holder / chat */
  .bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
  .chip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px 3px 7px;border-radius:999px;background:var(--surface);border:1px solid var(--border);font-size:11.5px}
  .chip i{width:8px;height:8px;border-radius:50%}
  .badge{padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:600;color:var(--accent-text);background:color-mix(in srgb,var(--accent) 14%,transparent);border:1px solid color-mix(in srgb,var(--accent) 40%,transparent)}
  .log{height:min(230px,34vh);overflow-y:auto;display:flex;flex-direction:column;gap:2px;margin:0 -6px;padding:0 6px;scrollbar-width:thin;scrollbar-color:var(--border) transparent}
  .empty{margin:auto;text-align:center;font-size:12px;color:var(--muted)}
  .msg{padding:6px 8px;border-radius:10px}
  .msg.me{background:color-mix(in srgb,var(--accent) 11%,transparent)}
  .meta{display:flex;align-items:baseline;gap:6px;font-size:11px;color:var(--muted)}
  .who{font-weight:600}
  .devtag{padding:0 7px;border-radius:999px;background:var(--accent);color:var(--on-accent);font-size:10px;font-weight:800;line-height:15px;letter-spacing:.02em}
  .time{margin-left:auto;font-variant-numeric:tabular-nums}
  .body{overflow-wrap:anywhere;white-space:pre-wrap}
  form{display:flex;gap:6px;margin-top:10px}
  input{flex:1;min-width:0;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:999px;padding:8px 14px;font:inherit;outline:none;transition:border-color .15s}
  input::placeholder{color:var(--muted)}
  input:focus{border-color:var(--accent)}
  .send{width:36px;height:36px;flex:none;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--on-accent);transition:filter .15s,transform .1s}
  .send:hover{filter:brightness(1.08)} .send:active{transform:scale(.95)}
  .notice{min-height:16px;font-size:11px;color:var(--warn);margin-top:6px}
`;

/** Floating panel in a shadow root: site css cannot leak in, ours cannot leak out. */
export function mountPanel(onSend: (text: string) => Promise<void>): Panel {
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>${CSS}</style>
    <div class="dock" id="dock" data-min="false" data-s="idle">
      <button class="pill" id="pill" aria-label="Open family chat"><span class="logo">${logo("p")}<span class="dot"></span></span><span class="unread" id="unread" hidden></span></button>
      <section class="card" aria-label="${t.wordmark} chat">
        <header><span class="logo sm">${logo("h")}<span class="dot"></span></span><span class="mark">${t.wordmark}</span><span class="tag">${t.hostTag}</span><span class="grow"></span><span class="ticker" id="ticker" hidden></span>
          <button class="icon" id="min" aria-label="Minimize" title="Minimize (Esc)">${ICON.min}</button></header>
        <main id="body"></main>
        <footer>${t.footer}</footer>
      </section>
    </div>`;
  document.documentElement.appendChild(host);
  // Narrow layouts have a full-width trade bar along the bottom edge; sit above it.
  const place = () => { host.style.bottom = window.innerWidth < 900 ? "88px" : "16px"; };
  place();
  window.addEventListener("resize", place);

  const $ = (id: string) => root.getElementById(id)!;
  const dock = $("dock"), body = $("body"), unreadEl = $("unread");
  watchSiteTheme((m) => { dock.dataset.theme = m; });
  let me = "";
  let unread = 0;

  // Minimized state survives page loads. Storage can throw in private windows, so it is optional.
  const getMin = () => { try { return localStorage.getItem(MIN_KEY) !== "0"; } catch { return true; } }; // default: minimized
  function setMin(v: boolean) {
    dock.dataset.min = String(v);
    try { localStorage.setItem(MIN_KEY, v ? "1" : "0"); } catch { /* ignore */ }
    if (!v) { unread = 0; showUnread(); (root.getElementById("i") as HTMLInputElement | null)?.focus(); }
  }
  function showUnread() {
    unreadEl.hidden = unread === 0;
    unreadEl.textContent = unread > 99 ? "99+" : String(unread);
    $("pill").setAttribute("aria-label", unread ? `Open family chat, ${unread} unread` : "Open family chat");
  }
  $("min").addEventListener("click", () => setMin(true));
  $("pill").addEventListener("click", () => setMin(false));
  root.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Escape") setMin(true); });
  setMin(getMin());

  const NOTICES: Record<string, string> = {
    slow_down: "Slow down a little.",
    too_long: "Too long, keep it under 280.",
    not_holder: "Hold this token to keep chatting.",
  };
  const setNotice = (text: string) => { const n = root.getElementById("n"); if (n) n.textContent = text; };

  function row(m: ChatMessage) {
    const mine = m.address === me;
    const el = document.createElement("div");
    el.className = "msg" + (mine ? " me" : "");
    const meta = document.createElement("div");
    meta.className = "meta";
    const who = document.createElement("span");
    who.className = "who";
    who.style.color = `hsl(${hue(m.address)} 55% var(--name-l))`;
    who.textContent = mine ? "you" : short(m.address);
    const pct = document.createElement("span");
    pct.textContent = fmtPct(m.pct);
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    meta.append(who);
    if (m.dev) { const d = document.createElement("span"); d.className = "devtag"; d.textContent = "dev"; meta.append(d); }
    meta.append(pct, time);
    const text = document.createElement("div");
    text.className = "body";
    text.textContent = m.text; // textContent only: chat is untrusted input
    el.append(meta, text);
    return el;
  }

  const gate = (title: string, sub: string, extra = "") =>
    `<div class="gate"><div class="lock">${ICON.lock}</div><h3>${title}</h3><div class="m sm">${sub}</div>${extra}</div>`;
  const stat = (n?: number) => (n == null ? "" : `<div class="stat"><span class="dot"></span><b>${n}</b> ${n === 1 ? "member" : "members"}</div>`);

  return {
    setChatNotice: setNotice,
    setTicker(symbol) {
      const el = $("ticker");
      el.hidden = !symbol;
      el.textContent = symbol ? `$${symbol}` : ""; // textContent only: the symbol is chosen by the token's creator
      el.title = symbol ? `$${symbol}` : "";
    },
    addMessages(msgs, reset) {
      const log = root.getElementById("log");
      if (!log) return;
      if (reset) { log.textContent = ""; unread = 0; showUnread(); } // new room: drop the old room's unread count
      if (!msgs.length) {
        if (!log.childElementCount) log.innerHTML = `<div class="empty">No messages yet.<br/>Say gm to the family.</div>`;
        return;
      }
      log.querySelector(".empty")?.remove();
      const pinned = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
      for (const m of msgs) log.appendChild(row(m));
      if (pinned || reset) log.scrollTop = log.scrollHeight;
      if (!reset && dock.dataset.min === "true") { unread += msgs.filter((m) => m.address !== me).length; showUnread(); }
    },
    render(s) {
      if ("wallet" in s) me = s.wallet.address.toLowerCase();
      dock.dataset.s = s.kind === "holder" ? "live" : s.kind === "error" ? "warn" : "idle";
      const wrongNet = "wallet" in s && !isRobinhood(s.wallet.chainId);
      const net = wrongNet ? `<div class="note">Switch your wallet to ${CHAIN.name} (chain ${CHAIN.id}).</div>` : "";
      switch (s.kind) {
        case "no-token":
          body.innerHTML = `<div class="m">Open a token page on the launchpad to find its community.</div>`; break;
        case "no-wallet":
          body.innerHTML = gate("Community chat", "Connect your wallet on the site and we will check if you are in.", stat(s.holders)); break;
        case "checking":
          body.innerHTML = `<div class="gate"><div class="skel" style="width:60%"></div><div class="skel" style="width:85%"></div><div class="m sm">Checking your balance</div></div>`; break;
        case "locked":
          body.innerHTML = gate("Join the community", `Hold this token to unlock the chat and talk with everyone in it.`, stat(s.holders) + net); break;
        case "error":
          body.innerHTML = gate("Something went wrong", esc(s.message)); break;
        case "holder": {
          const bar = `<div class="chip"><i style="background:hsl(${hue(s.wallet.address)} 55% var(--name-l))"></i>${esc(s.wallet.connectorName)} <code>${short(s.wallet.address)}</code></div>
            ${s.isDev ? `<span class="devtag">dev</span>` : ""}<span class="badge">${fmtPct(s.holding.pct)} of supply</span>${s.holders != null ? `<span class="m sm">${s.holders} ${s.holders === 1 ? "member" : "members"}</span>` : ""}${net}`;
          // Keep the chat DOM across re-renders so typing and scroll position survive the 30s recheck.
          if (root.getElementById("log")) { $("bar").innerHTML = bar; break; }
          body.innerHTML = `<div class="bar" id="bar">${bar}</div><div class="log" id="log"></div>
            <form id="f"><input id="i" maxlength="280" placeholder="Message the family" autocomplete="off"/><button class="send" aria-label="Send">${ICON.send}</button></form>
            <div class="notice" id="n"></div>`;
          const input = $("i") as HTMLInputElement;
          $("f").addEventListener("submit", async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            input.value = "";
            try { await onSend(text); setNotice(""); } catch (err: any) { input.value = text; setNotice(NOTICES[err?.message] ?? "Could not send."); }
          });
          break;
        }
      }
    },
  };
}
