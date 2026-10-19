// Reads the wallet the user already picked on the site (Reown AppKit + wagmi persist it in localStorage).
// No popup, no provider needed to learn the address.
export type SiteWallet = {
  address: string;
  chainId: number;
  connectorId: string; // wagmi connector id, for injected wallets this is the EIP-6963 rdns
  connectorName: string;
  connectorType: string; // "injected" | "walletConnect" | "coinbaseWallet" | ...
};

function mapEntries(v: any): [string, any][] {
  if (v?.__type === "Map") return v.value;
  return Object.entries(v ?? {});
}

export function readSiteWallet(): SiteWallet | null {
  try {
    const raw = localStorage.getItem("wagmi.store");
    if (!raw) return null;
    const state = JSON.parse(raw)?.state;
    const conns = mapEntries(state?.connections);
    const cur = conns.find(([uid]) => uid === state?.current)?.[1] ?? conns[0]?.[1];
    const address = cur?.accounts?.[0];
    if (!address) return null;
    return {
      address: String(address).toLowerCase(),
      chainId: Number(cur.chainId ?? state?.chainId),
      connectorId: cur.connector?.id ?? "",
      connectorName: cur.connector?.name ?? "wallet",
      connectorType: cur.connector?.type ?? "",
    };
  } catch {
    return null;
  }
}

/** localStorage change events do not fire in the same document, so poll cheaply and emit on change. */
export function watchSiteWallet(cb: (w: SiteWallet | null) => void, ms = 1500): () => void {
  let last = "__init__";
  const tick = () => {
    const w = readSiteWallet();
    const key = w ? `${w.address}:${w.chainId}:${w.connectorId}` : "";
    if (key !== last) { last = key; cb(w); }
  };
  tick();
  const id = setInterval(tick, ms);
  return () => clearInterval(id);
}
