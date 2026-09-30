import mappings from "../data/action-mappings.json" with { type: "json" };
import { buildLocalAnalysis, getModelCatalogue, getSelectionPool, parseModelAnalysis, type ExposureCounts } from "./experience-match.ts";
import { MATCH_SYSTEM_PROMPT } from "./match-prompt.ts";
export type LlmEnvironment = { LLM_API_KEY?: string; LLM_API_URL?: string; LLM_MODEL?: string; LLM_TIMEOUT_MS?: string };
export function getLlmConfig(env: LlmEnvironment) {
  return { endpoint: env.LLM_API_URL || "https://api.deepseek.com/chat/completions", apiKey: env.LLM_API_KEY?.trim() || "",
    model: env.LLM_MODEL || "deepseek-flash", timeout: Math.min(15000, Math.max(1000, Number(env.LLM_TIMEOUT_MS) || 12000)) };
}
export async function analyzeQuery(query: string, env: LlmEnvironment, counts: ExposureCounts = {}, fetcher: typeof fetch = fetch) {
  const local = buildLocalAnalysis(query);
  const config = getLlmConfig(env);
  const fallback = (model_status: string) => ({ analysis: local, engine: "local" as const, model_status });
  if (!config.apiKey) return fallback("missing_key");
  try {
    const response = await fetcher(config.endpoint, {
      method: "POST", headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" }, signal: AbortSignal.timeout(config.timeout),
      body: JSON.stringify({ model: config.model, temperature: 0.2, max_tokens: 2400, response_format: { type: "json_object" },
        ...(new URL(config.endpoint).hostname === "api.deepseek.com" ? { thinking: { type: "disabled" } } : {}),
        messages: [{ role: "system", content: MATCH_SYSTEM_PROMPT }, { role: "user", content: JSON.stringify({ query, catalogue: getModelCatalogue(counts),
          mappings: mappings.map(({ id, normalized_intent, routes, exclusions }) => ({ id, normalized_intent, routes, exclusions })) }) }] }),
    });
    if (!response.ok) return fallback("provider_error");
    const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
    const choice = payload.choices?.[0];
    if (choice?.finish_reason && choice.finish_reason !== "stop") return fallback("incomplete_response");
    const analysis = parseModelAnalysis(choice?.message?.content ?? "", query);
    if (!analysis || !getSelectionPool(analysis, query).length) return fallback("invalid_response");
    return { analysis, engine: "llm" as const, model_status: "ready" };
  } catch (error) { return fallback(error instanceof Error && /timeout|abort/i.test(error.name) ? "timeout" : "provider_error"); }
}
