import assert from "node:assert/strict";
import { test } from "node:test";
import { newMatchRequestId, requestBrowserMatch } from "../lib/browser-match-request.ts";
import { resolveExperienceMatch } from "../lib/experience-match.ts";

test("legacy mobile crypto can create valid request IDs without randomUUID", () => {
  for (const cryptoApi of [{ getRandomValues: (bytes) => bytes.fill(7) }, {}])
    assert.match(newMatchRequestId(cryptoApi), /^[a-zA-Z0-9_-]{8,80}$/);
});
test("successful match uses one request and a basic AbortController signal", async () => {
  let calls = 0;
  const expected = resolveExperienceMatch("拜观音");
  const result = await requestBrowserMatch("https://api.example.com/api/match", "拜观音", {
    signal: new AbortController().signal, fetcher: async (_, init) => {
      calls++; assert.equal(init.signal.aborted, false); assert.equal(JSON.parse(init.body).query, "拜观音");
      return Response.json(expected);
    },
  });
  assert.equal(calls, 1); assert.equal(result.deity.id, expected.deity.id); assert.equal(result.message, expected.message);
});
test("unresponsive mobile fetch exits at the deadline even if it ignores abort", async () => {
  let networkSignal;
  await assert.rejects(requestBrowserMatch("https://api.example.com", "拜观音", {
    signal: new AbortController().signal, timeoutMs: 20, fetcher: async (_, init) => {
      networkSignal = init.signal; return new Promise(() => {});
    },
  }), { name: "TimeoutError" });
  assert.equal(networkSignal.aborted, true);
});
test("response headers alone do not bypass the deadline when the body stalls", async () => {
  await assert.rejects(requestBrowserMatch("https://api.example.com", "拜观音", {
    signal: new AbortController().signal, timeoutMs: 20,
    fetcher: async () => ({ ok: true, json: () => new Promise(() => {}) }),
  }), { name: "TimeoutError" });
});
test("returning to edit cancels promptly even if the WebView ignores abort", async () => {
  const controller = new AbortController();
  const request = requestBrowserMatch("https://api.example.com", "拜观音", {
    signal: controller.signal, timeoutMs: 20000, fetcher: async () => new Promise(() => {}),
  });
  controller.abort();
  await assert.rejects(request, { name: "AbortError" });
});
test("invalid API response is rejected so the page can use its local fallback", async () => {
  for (const payload of [null, {}, { ...resolveExperienceMatch("拜观音"), deity: { id: "UNKNOWN" } }])
    await assert.rejects(requestBrowserMatch("https://api.example.com", "拜观音", {
      signal: new AbortController().signal, fetcher: async () => Response.json(payload),
    }), /Invalid match response/);
});
