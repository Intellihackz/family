export const CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  explorer: "https://robinhoodchain.blockscout.com",
  // TODO: RPC url is not confirmed yet. Server side only, never hardcode a guess.
} as const;

export const TESTNET = { id: 46630, explorer: "https://explorer.testnet.chain.robinhood.com" } as const;

export const isRobinhood = (chainId: number) => chainId === CHAIN.id;
