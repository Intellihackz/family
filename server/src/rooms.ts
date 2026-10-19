import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Address } from "viem";
import { holding } from "./chain.js";
import { devAddresses } from "./launch.js";

export type ChatMessage = { id: number; address: string; text: string; ts: number; pct: number; dev?: boolean };
type Room = { msgs: ChatMessage[]; nextId: number; waiters: Set<() => void> };

const MAX_KEPT = 200;
const MAX_LEN = 280;
const MIN_GAP_MS = 2_000;
const WAIT_MAX_MS = 20_000;
// Where chat history lives. Railway sets RAILWAY_VOLUME_MOUNT_PATH when a Volume is attached, so attaching one is
// enough. Without a volume the disk is wiped on every deploy and chat history disappears.
const VOLUME = process.env.DATA_DIR ?? process.env.RAILWAY_VOLUME_MOUNT_PATH;
const DIR = VOLUME ?? "data";
const FILE = join(DIR, "rooms.json");
const ON_RAILWAY = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

export class ChatError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

const rooms = new Map<Address, Room>();
const lastPost = new Map<string, number>();

let loadedMessages = 0;
let lastSaveAt = 0;
let lastSaveError: string | undefined;

function load() {
  if (!existsSync(FILE)) return;
  try {
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(FILE, "utf8")) as Record<string, { msgs: ChatMessage[]; nextId: number }>)) {
      rooms.set(k as Address, { ...v, waiters: new Set() });
      loadedMessages += v.msgs.length;
    }
  } catch (e) { lastSaveError = `could not read ${FILE}: ${(e as Error).message}`; }
}
load();
console.log(`chat storage: ${FILE} (${VOLUME ? "persistent volume" : "local disk"}), loaded ${loadedMessages} messages in ${rooms.size} rooms`);
if (ON_RAILWAY && !VOLUME) console.warn("WARNING: running on Railway without a Volume. Chat history is wiped on every deploy. Attach a Volume to this service.");

/** Write to a temp file then rename, so a crash mid-write can never leave a half-written rooms.json. */
function save() {
  try {
    mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries([...rooms].map(([k, r]) => [k, { msgs: r.msgs, nextId: r.nextId }]))));
    renameSync(tmp, FILE);
    lastSaveAt = Date.now();
    lastSaveError = undefined;
  } catch (e) {
    // A failed save must never take the chat server down.
    lastSaveError = (e as Error).message;
    console.error("chat save failed:", lastSaveError);
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
}

/** Write pending changes now. Called on shutdown: Railway sends SIGTERM on every redeploy. */
export function flush() {
  clearTimeout(saveTimer);
  save();
}

export const storageInfo = () => ({
  persistent: Boolean(VOLUME),
  dir: DIR,
  rooms: rooms.size,
  messages: [...rooms.values()].reduce((n, r) => n + r.msgs.length, 0),
  loadedOnStart: loadedMessages,
  lastSaveAt: lastSaveAt || null,
  error: lastSaveError ?? null,
});

const room = (t: Address) => {
  let r = rooms.get(t);
  if (!r) rooms.set(t, (r = { msgs: [], nextId: 1, waiters: new Set() }));
  return r;
};

/** Holders get in. The token's dev gets in too, even at zero balance: they are the most relevant person in the room. */
async function requireHolder(token: Address, address: Address) {
  const h = await holding(token, address);
  if (h.isHolder) return h;
  if ((await devAddresses(token)).has(address.toLowerCase())) return h;
  throw new ChatError("not_holder", 403);
}

export async function post(token: Address, address: Address, raw: unknown) {
  const h = await requireHolder(token, address);
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) throw new ChatError("empty", 400);
  if (text.length > MAX_LEN) throw new ChatError("too_long", 400);
  const k = `${token}:${address}`;
  if (Date.now() - (lastPost.get(k) ?? 0) < MIN_GAP_MS) throw new ChatError("slow_down", 429);
  lastPost.set(k, Date.now());

  const r = room(token);
  const msg: ChatMessage = { id: r.nextId++, address: address.toLowerCase(), text, ts: Date.now(), pct: h.pct };
  r.msgs.push(msg);
  if (r.msgs.length > MAX_KEPT) r.msgs.splice(0, r.msgs.length - MAX_KEPT);
  for (const wake of r.waiters) wake();
  persist();
  return { ...msg, dev: (await devAddresses(token)).has(msg.address) };
}

/** Long-poll: returns messages after `after`, or waits up to 20s for one to arrive. */
export async function poll(token: Address, address: Address, after: number) {
  await requireHolder(token, address);
  const r = room(token);
  const pick = () => r.msgs.filter((m) => m.id > after);
  const devs = await devAddresses(token); // flag at read time so a late or failed lookup self-heals
  const tag = (ms: ChatMessage[]) => ms.map((m) => ({ ...m, dev: devs.has(m.address) }));
  if (after === 0) return { messages: tag(r.msgs.slice(-50)), last: r.nextId - 1 }; // history on join
  let out = pick();
  if (!out.length) {
    await new Promise<void>((res) => {
      const done = () => { clearTimeout(t); r.waiters.delete(done); res(); };
      const t = setTimeout(done, WAIT_MAX_MS);
      r.waiters.add(done);
    });
    out = pick();
  }
  return { messages: tag(out), last: out.length ? out[out.length - 1].id : after };
}

/** Moderator removal. Clients see the id disappear on their next history load. */
export function remove(token: Address, id: number) {
  const r = rooms.get(token);
  if (!r) return false;
  const n = r.msgs.length;
  r.msgs = r.msgs.filter((m) => m.id !== id);
  if (r.msgs.length !== n) persist();
  return r.msgs.length !== n;
}
