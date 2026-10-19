import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { holderCount, holding, parseAddr } from "./chain.js";
import { devAddresses, tokenLabel } from "./launch.js";
import { ChatError, flush, poll, post, remove, storageInfo } from "./rooms.js";

const app = new Hono();
app.use("*", cors());
// Health stays 200 even if storage is unhealthy, so a bad disk never blocks a deploy. Read "storage" to see the truth.
app.get("/health", (c) => c.json({ ok: true, storage: storageInfo() }));

// Does this address hold this token, and how much.
app.get("/holder", async (c) => {
  const token = parseAddr(c.req.query("token"));
  const owner = parseAddr(c.req.query("address"));
  if (!token || !owner) return c.json({ error: "bad_address" }, 400);
  try {
    const [h, devs, label] = await Promise.all([holding(token, owner), devAddresses(token), tokenLabel(token)]);
    return c.json({ ...h, isDev: devs.has(owner.toLowerCase()), symbol: label.symbol });
  } catch {
    return c.json({ error: "not_a_token" }, 404);
  }
});

// How many holders are inside the room (shown on the locked state).
app.get("/holders", async (c) => {
  const token = parseAddr(c.req.query("token"));
  if (!token) return c.json({ error: "bad_address" }, 400);
  try {
    const [count, label] = await Promise.all([holderCount(token), tokenLabel(token)]);
    return c.json({ count, symbol: label.symbol });
  } catch {
    return c.json({ error: "rpc_failed" }, 502);
  }
});

const ADMIN_KEY = process.env.ADMIN_KEY; // moderation is disabled when unset

const fail = (c: any, e: unknown) =>
  e instanceof ChatError ? c.json({ error: e.code }, e.status) : c.json({ error: "server_error" }, 502);

app.get("/rooms/:token/messages", async (c) => {
  const token = parseAddr(c.req.param("token"));
  const address = parseAddr(c.req.query("address"));
  if (!token || !address) return c.json({ error: "bad_address" }, 400);
  try {
    return c.json(await poll(token, address, Number(c.req.query("after") ?? 0) || 0));
  } catch (e) { return fail(c, e); }
});

app.post("/rooms/:token/messages", async (c) => {
  const token = parseAddr(c.req.param("token"));
  const body = await c.req.json().catch(() => ({}));
  const address = parseAddr(body.address);
  if (!token || !address) return c.json({ error: "bad_address" }, 400);
  try {
    return c.json(await post(token, address, body.text));
  } catch (e) { return fail(c, e); }
});

app.delete("/rooms/:token/messages/:id", (c) => {
  if (!ADMIN_KEY || c.req.header("x-admin-key") !== ADMIN_KEY) return c.json({ error: "forbidden" }, 403);
  const token = parseAddr(c.req.param("token"));
  if (!token) return c.json({ error: "bad_address" }, 400);
  return c.json({ removed: remove(token, Number(c.req.param("id"))) });
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`family server on :${port}`);

// Railway sends SIGTERM on every redeploy. Save the last messages before exiting.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => { flush(); process.exit(0); });
}
