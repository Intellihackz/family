import { isAddress, type Address } from "viem";

// The launchpad already knows who the dev is and where the curve lives. We read their public API
// instead of guessing from chain data.
const BASE = process.env.PONS_API ?? "https://ponsfamily.com";
const TTL = 10 * 60_000; // dev and curve never change for a token, so a long cache is safe
const DEAD = "0x000000000000000000000000000000000000dead";

type Info = { devs: Set<string>; contracts: Set<string>; symbol?: string; name?: string; at: number };
const cache = new Map<Address, Info>();

/** Token symbols and names are chosen by whoever launches the token, so treat them as untrusted text:
 *  drop control and invisible direction characters (used to spoof what a label says), a leading "$", and cap the length. */
const clean = (v: unknown, max: number): string | undefined =>
  typeof v === "string"
    ? v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, "").trim().replace(/^\$+/, "").slice(0, max) || undefined
    : undefined;

async function getJson(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json() as Promise<any>;
}

async function info(token: Address): Promise<Info> {
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < TTL) return hit;
  const [flags, launch] = await Promise.allSettled([
    getJson(`${BASE}/api/launches/${token}?view=trader-flags`),
    getJson(`${BASE}/api/launches/${token}`),
  ]);
  // Their API being down must never break chat: keep the stale values and retry soon.
  const next: Info = {
    devs: flags.status === "fulfilled" ? new Set<string>((flags.value.dev ?? []).map((a: string) => a.toLowerCase())) : hit?.devs ?? new Set(),
    contracts: launch.status === "fulfilled"
      ? new Set<string>([launch.value.curve, launch.value.pool].filter((a) => typeof a === "string" && isAddress(a)).map((a: string) => a.toLowerCase()))
      : hit?.contracts ?? new Set(),
    symbol: launch.status === "fulfilled" ? clean(launch.value.symbol, 16) : hit?.symbol,
    name: launch.status === "fulfilled" ? clean(launch.value.name, 48) : hit?.name,
    at: flags.status === "fulfilled" && launch.status === "fulfilled" ? Date.now() : Date.now() - TTL + 30_000,
  };
  cache.set(token, next);
  return next;
}

export async function tokenLabel(token: Address): Promise<{ symbol?: string; name?: string }> {
  const { symbol, name } = await info(token);
  return { symbol, name };
}

export const devAddresses = async (token: Address) => (await info(token)).devs;

/** Addresses that hold supply but are not people: the curve, the pool, the token itself, the burn address. */
export async function nonHolders(token: Address): Promise<Set<string>> {
  return new Set([...(await info(token)).contracts, token.toLowerCase(), DEAD]);
}
