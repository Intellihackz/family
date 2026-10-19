import { createPublicClient, defineChain, erc20Abi, getAddress, http, isAddress, parseAbiItem, zeroAddress, type Address } from "viem";
import { nonHolders } from "./launch.js";

const RPC = process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const client = createPublicClient({ chain: robinhood, transport: http(RPC) });

const MAX_RANGE = 9_000_000n; // node allows 10M per getLogs query
const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

type Ttl<T> = { v: T; at: number };
const fresh = <T>(e: Ttl<T> | undefined, ms: number) => (e && Date.now() - e.at < ms ? e.v : undefined);

export const parseAddr = (a: string | undefined): Address | null => (a && isAddress(a) ? getAddress(a) : null);

const meta = new Map<Address, { decimals: number; supply: bigint }>();
async function tokenMeta(token: Address) {
  const hit = meta.get(token);
  if (hit) return hit;
  const [decimals, supply] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }),
  ]);
  const m = { decimals, supply };
  meta.set(token, m);
  return m;
}

const balCache = new Map<string, Ttl<bigint>>();
/** Server side balanceOf, cached briefly so the RPC is not hit on every request. */
export async function holding(token: Address, owner: Address) {
  const k = `${token}:${owner}`;
  let bal = fresh(balCache.get(k), 15_000);
  if (bal === undefined) {
    bal = await client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] });
    balCache.set(k, { v: bal, at: Date.now() });
  }
  const { decimals, supply } = await tokenMeta(token);
  return {
    isHolder: bal > 0n,
    balance: bal.toString(),
    supply: supply.toString(),
    decimals,
    pct: supply > 0n ? Number((bal * 10_000_000n) / supply) / 100_000 : 0,
  };
}

// Holder count: tally Transfer logs per token, then only read new blocks on later calls.
type Index = { balances: Map<Address, bigint>; scanned: bigint; running?: Promise<void>; at: number };
const indexes = new Map<Address, Index>();

async function advance(token: Address, ix: Index) {
  const head = await client.getBlockNumber();
  let from = ix.scanned + 1n;
  while (from <= head) {
    const to = from + MAX_RANGE - 1n < head ? from + MAX_RANGE - 1n : head;
    const logs = await client.getLogs({ address: token, event: TRANSFER, fromBlock: from, toBlock: to });
    for (const l of logs) {
      const { from: f, to: t, value } = l.args as { from: Address; to: Address; value: bigint };
      if (f !== zeroAddress) ix.balances.set(f, (ix.balances.get(f) ?? 0n) - value);
      if (t !== zeroAddress) ix.balances.set(t, (ix.balances.get(t) ?? 0n) + value);
    }
    ix.scanned = to;
    from = to + 1n;
  }
  ix.at = Date.now();
}

export async function holderCount(token: Address): Promise<number> {
  let ix = indexes.get(token);
  if (!ix) {
    const head = await client.getBlockNumber();
    // Start one window back. Launchpad tokens are young; widen if older tokens matter.
    ix = { balances: new Map(), scanned: (head > MAX_RANGE ? head - MAX_RANGE : 0n) - 1n, at: 0 };
    indexes.set(token, ix);
  }
  if (Date.now() - ix.at > 30_000) {
    ix.running ??= advance(token, ix).finally(() => { ix!.running = undefined; });
    await ix.running;
  }
  const skip = await nonHolders(token);
  let n = 0;
  for (const [addr, v] of ix.balances) if (v > 0n && !skip.has(addr.toLowerCase())) n++;
  return n;
}
