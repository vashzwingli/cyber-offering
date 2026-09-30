import deities from "../data/deities.json" with { type: "json" };
import type { MatchResult } from "./match.ts";

type RequestOptions = { signal: AbortSignal; timeoutMs?: number; fetcher?: typeof fetch };
export function newMatchRequestId(cryptoApi: Partial<Crypto> | undefined = globalThis.crypto): string {
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return `match_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  // This identifies a draw; it is not an authentication credential.
  return `match_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

export async function requestBrowserMatch(url: string, query: string, { signal, timeoutMs = 20000, fetcher = fetch }: RequestOptions): Promise<MatchResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const stopped = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new DOMException("Request cancelled", "AbortError")); };
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new DOMException("Match request timed out", "TimeoutError"));
    }, timeoutMs);
  });
  const request = async () => {
    if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
    const response = await fetcher(url, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, mode: "experience", request_id: newMatchRequestId() }), signal: controller.signal });
    if (!response.ok) throw new Error("Match request failed");
    const payload = await response.json() as MatchResult | null;
    const deity = deities.find((item) => item.id === payload?.deity?.id);
    if (!payload || payload.status !== "matched" || !deity || typeof payload.message !== "string"
      || typeof payload.query !== "string" || !["llm", "local", "cached"].includes(payload.engine)) throw new Error("Invalid match response");
    return { ...payload, deity };
  };
  try {
    // Bound fetch AND body parsing, even if a mobile WebView ignores abort.
    return await Promise.race([request(), stopped]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
