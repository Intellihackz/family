const TOKEN_PATH = /^\/launchpad\/(0x[a-fA-F0-9]{40})\/?$/;

/** Room id is the token contract address, lowercased. Only /launchpad/<address> pages get a room. */
export function tokenFromLocation(loc: Location = window.location): string | null {
  const m = loc.pathname.match(TOKEN_PATH);
  return m ? m[1].toLowerCase() : null;
}
