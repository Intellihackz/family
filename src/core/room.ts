import type { Msg } from "../background";

async function bg<T>(m: Msg): Promise<T> {
  const r = await chrome.runtime.sendMessage(m);
  if (!r?.ok) throw new Error(r?.error ?? "background_failed");
  return r.data as T;
}

export type HolderInfo = { isDev: boolean; isHolder: boolean; balance: string; supply: string; decimals: number; pct: number };
export const checkHolder = (token: string, address: string) => bg<HolderInfo>({ type: "holder", token, address });
export const holderCount = (token: string) => bg<{ count: number }>({ type: "holders", token }).then((r) => r.count);

export type ChatMessage = { id: number; address: string; text: string; ts: number; pct: number; dev?: boolean };

/** Transport lives here only. Swap long-poll for websockets/Supabase later without touching the panel. */
export const pollMessages = (token: string, address: string, after: number) =>
  bg<{ messages: ChatMessage[]; last: number }>({ type: "poll", token, address, after });
export const sendMessage = (token: string, address: string, text: string) =>
  bg<ChatMessage>({ type: "send", token, address, text });
