import { getD1, getLlmEnvironment } from "../db/index";
import { buildExperienceResult, buildLocalAnalysis, getSelectionPool, selectBalancedCandidate, type ExposureCounts, type Analysis } from "./experience-match";
import { analyzeQuery, getLlmConfig } from "./online-analysis";
import { readCounts, readDraw, recordDraw, RequestConflictError } from "./exposure-store";
export { RequestConflictError };
async function state() {
  const db = getD1();
  if (db) try { return { db, counts: await readCounts(db) }; } catch { /* Unavailable state never prevents a match. */ }
  return { db: undefined, counts: {} as ExposureCounts };
}
export async function previewMatch(query: string) {
  const { counts } = await state();
  const result = await analyzeQuery(query, getLlmEnvironment(), counts);
  return { ...result, candidates: getSelectionPool(result.analysis, query) };
}
export async function matchExperience(query: string, requestId: string) {
  const queryHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`experience:${query}`))))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const { db, counts } = await state();
  if (db) {
    let prior;
    try { prior = await readDraw(db, requestId); } catch { /* Continue with the fallback if storage fails. */ }
    if (prior) {
      if (prior.query_hash !== queryHash) throw new RequestConflictError();
      const analysis = buildLocalAnalysis(query); analysis.intents[0].category = prior.category;
      return buildExperienceResult(query, analysis, { ...prior, intent_index: 0 }, { engine: "cached", modelStatus: "replayed", balanced: true, persistence: "d1", replayed: true });
    }
  }
  const { analysis, engine, model_status } = await analyzeQuery(query, getLlmEnvironment(), counts);
  const pool = getSelectionPool(analysis, query);
  let selected = selectBalancedCandidate(pool, counts)!;
  let persistent = false; let replayed = false; let finalAnalysis: Analysis = analysis;
  if (db) try {
    const recorded = await recordDraw(db, requestId, queryHash, pool.map((candidate) => ({ ...candidate, category: analysis.intents[candidate.intent_index].category })));
    selected = { ...recorded.draw, intent_index: pool.find((candidate) => candidate.deity_id === recorded.draw.deity_id)?.intent_index ?? 0 };
    if (!pool.some((candidate) => candidate.deity_id === recorded.draw.deity_id)) {
      finalAnalysis = buildLocalAnalysis(query); finalAnalysis.intents[0].category = recorded.draw.category;
    }
    persistent = true; replayed = recorded.replayed;
  } catch (error) { if (error instanceof RequestConflictError) throw error; }
  return buildExperienceResult(query, finalAnalysis, selected, { engine, modelStatus: model_status, balanced: persistent, persistence: persistent ? "d1" : "unavailable", replayed });
}
export async function matchStatus() {
  const { db } = await state(); const config = getLlmConfig(getLlmEnvironment());
  return { provider: new URL(config.endpoint).hostname, model: config.model, configured: !!config.apiKey, database_ready: !!db };
}
export async function matchStats() {
  const { db, counts } = await state();
  return { persistence: db ? "d1" : "unavailable", window_size: 1000, counts };
}
