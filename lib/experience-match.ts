import { z } from "zod";
import deities from "../data/deities.json" with { type: "json" };
import mappings from "../data/action-mappings.json" with { type: "json" };
import themes from "../data/experience-themes.json" with { type: "json" };
import { findRuleMappingId } from "./intent-router.ts";
import type { Deity, Mapping, MatchResult } from "./match.ts";
import { buildMatchReason, getTravelDomain } from "./match-reason.ts";

export const categories = ["learning", "wealth", "relationships", "health", "family", "travel", "craft", "performance", "food", "home", "protection", "ethics", "nature", "practice", "remembrance", "care", "everyday"] as const;
export type Category = typeof categories[number];
export type RelationLevel = "direct_traditional" | "contextual_direct" | "functional_analogy" | "symbolic_only";
export type Intent = { action: string; scene: string; wish: string; category: Category; priority: number; mapping_id: string | null };
export type Candidate = { deity_id: string; intent_index: number; score: number; relation_level: RelationLevel };
export type Analysis = { intents: Intent[]; excluded_categories: Category[]; candidates: Candidate[] };
export type Exposure = { recent_count: number; total_count: number; last_shown: number };
export type ExposureCounts = Record<string, Exposure>;
export type ExperienceResult = MatchResult & {
  analysis: Omit<Analysis, "candidates">;
  candidates: Candidate[];
  relation_level: RelationLevel;
  selection: { balanced: boolean; persistence: "d1" | "unavailable" | "offline"; replayed: boolean; window_size: number };
  model_status: string;
};

const schema = z.object({
  intents: z.array(z.object({ action: z.string().max(240), scene: z.string().max(160), wish: z.string().max(240), category: z.enum(categories), priority: z.number().int().min(1).max(3), mapping_id: z.string().nullable() })).min(1).max(4),
  excluded_categories: z.array(z.enum(categories)).max(17),
  candidates: z.array(z.object({ deity_id: z.string(), intent_index: z.number().int().min(0).max(3), score: z.number().int().min(0).max(100), relation_level: z.enum(["direct_traditional", "contextual_direct", "functional_analogy", "symbolic_only"]) })).min(1).max(12),
});

export function findNamedDeities(query: string) {
  const compact = query.trim().replace(/[，。！？、\s]/g, "");
  return deities.filter((deity) => [deity.canonical_name, ...deity.aliases, ...deity.honorific_names].some((name) =>
    compact === name || (name.length >= 2 && compact.includes(name) && !new RegExp(`(?:不想|不要|不求|不拜|不)(?:拜|求|选|找)?${name}`).test(compact))));
}

function themeMatchesDeity(category: Category, deity: Deity) {
  const theme = themes.find((item) => item.id === category);
  return !!theme && theme.domains.some((term) => deity.domains.some((domain) => domain.includes(term)));
}

function fitsScene(category: Category, deity: Deity, query: string) {
  if (category === "nature" && /追星|偶像/.test(query) && !/观星|星空|星辰|天文|雨|水|天气|雷|自然/.test(query)) return false;
  if (category === "travel") return !!getTravelDomain(query, deity);
  if (category === "performance" && /偶像|追星|应援|演唱会|见面会/.test(query))
    return deity.domains.some((domain) => /音乐|戏曲|表演/.test(domain));
  return true;
}

export function buildLocalAnalysis(query: string): Analysis {
  const normalized = query.trim().slice(0, 240);
  const clauses = normalized.split(/[，。！？；,;]|但是|而是|只想|但/).filter(Boolean);
  const excluded = themes.filter((theme) => clauses.some((clause) => {
    const topic = new RegExp(`(?:不想|不要|不求|不打算|不是)(?:去|再|要|谈)?(?:${theme.pattern})(?:了)?$`);
    return topic.test(clause.trim());
  })).map((theme) => theme.id as Category);
  const positive = clauses.filter((clause) => !/^(?:我)?(?:不想|不要|不求|不打算|不是)/.test(clause) || /失败|挂科|生病|危险|出事/.test(clause)).join("，") || normalized;
  const matchedThemes = themes.filter((theme) => new RegExp(theme.pattern).test(positive) && !excluded.includes(theme.id as Category)).slice(0, 4);
  const intents: Intent[] = matchedThemes.length ? matchedThemes.map((theme, i) => ({ action: positive, scene: /日本/.test(positive) ? "日本" : "", wish: theme.id === "travel" && /偶像|追星|应援|演唱会|见面会/.test(positive) ? "旅途平安、相见如愿" : theme.label, category: theme.id as Category, priority: i === 0 ? 3 : 2, mapping_id: findRuleMappingId(positive) ?? null }))
    : [{ action: normalized, scene: "", wish: "日常心愿", category: "everyday", priority: 3, mapping_id: null }];
  const named = findNamedDeities(normalized);
  const candidates: Candidate[] = [];
  intents.forEach((intent, index) => {
    const mapping = mappings.find((item) => item.id === intent.mapping_id);
    const pool = named.length ? named : intent.category === "everyday" ? deities : deities.filter((deity) => themeMatchesDeity(intent.category, deity) && fitsScene(intent.category, deity, positive));
    for (const deity of pool) {
      if (excluded.some((category) => themeMatchesDeity(category, deity))) continue;
      const route = mapping?.routes.find((item) => item.target_id === deity.id);
      const direct = route?.relation_level === "direct_traditional";
      const contextual = route?.relation_level === "contextual_direct";
      candidates.push({ deity_id: deity.id, intent_index: index, score: named.length ? 100 : direct ? 96 : contextual ? 90 : intent.category === "everyday" ? 48 : 84,
        relation_level: direct ? "direct_traditional" : contextual ? "contextual_direct" : intent.category === "everyday" ? "symbolic_only" : "functional_analogy" });
    }
  });
  // Even a fully negated or unfamiliar input receives a symbolic object, never an invented office.
  if (!candidates.length) {
    intents.splice(0, intents.length, { action: normalized, scene: "", wish: "日常心愿", category: "everyday", priority: 3, mapping_id: null });
    const remaining = deities.filter((item) => !excluded.some((category) => themeMatchesDeity(category, item)));
    for (const deity of remaining.length ? remaining : deities)
      candidates.push({ deity_id: deity.id, intent_index: intents.length - 1, score: 48, relation_level: "symbolic_only" });
  }
  return { intents, excluded_categories: excluded, candidates };
}

export function parseModelAnalysis(content: string, query: string): Analysis | null {
  let value: unknown;
  try { value = JSON.parse(content); } catch { return null; }
  const parsed = schema.safeParse(value);
  if (!parsed.success) return null;
  const data = parsed.data;
  const local = buildLocalAnalysis(query);
  const excluded = [...new Set([...data.excluded_categories, ...local.excluded_categories])];
  const intents = data.intents.map((intent) => ({ ...intent, mapping_id: mappings.some((mapping) => mapping.id === intent.mapping_id) ? intent.mapping_id : null }));
  const candidates: Candidate[] = [];
  for (const candidate of data.candidates) {
    const deity = deities.find((item) => item.id === candidate.deity_id);
    const intent = intents[candidate.intent_index];
    if (!deity || !intent || excluded.some((category) => themeMatchesDeity(category, deity))) continue;
    if (intent.category === "everyday" && local.intents.some((item) => item.category !== "everyday") && !findNamedDeities(query).length) continue;
    if (intent.category !== "everyday" && !findNamedDeities(query).some((item) => item.id === deity.id) &&
      (!themeMatchesDeity(intent.category, deity) || !fitsScene(intent.category, deity, query))) continue;
    const route = mappings.find((mapping) => mapping.id === intent.mapping_id)?.routes.find((item) => item.target_id === deity.id);
    // The model cannot promote an unregistered association to a traditional fact.
    const relation = candidate.relation_level === "direct_traditional" || candidate.relation_level === "contextual_direct"
      ? route?.relation_level === "direct_traditional" ? "direct_traditional" : route?.relation_level === "contextual_direct" ? "contextual_direct" : "functional_analogy"
      : candidate.relation_level;
    candidates.push({ ...candidate, relation_level: relation });
  }
  if (!candidates.length) return null;
  return { intents, excluded_categories: excluded, candidates };
}

export function getSelectionPool(analysis: Analysis, query: string): Candidate[] {
  const named = findNamedDeities(query);
  if (named.length === 1) return [{ deity_id: named[0].id, intent_index: 0, score: 100, relation_level: "symbolic_only" }];
  const unique = new Map<string, Candidate>();
  for (const candidate of analysis.candidates) {
    if (!deities.some((deity) => deity.id === candidate.deity_id)) continue;
    const priority = analysis.intents[candidate.intent_index]?.priority ?? 1;
    const effective = Math.max(0, candidate.score - (3 - priority) * 8);
    const scored = { ...candidate, score: effective };
    if (!unique.has(candidate.deity_id) || unique.get(candidate.deity_id)!.score < effective) unique.set(candidate.deity_id, scored);
  }
  const candidates = [...unique.values()];
  const best = Math.max(...candidates.map((candidate) => candidate.score));
  return candidates.filter((candidate) => candidate.score >= Math.max(35, best - 18));
}

export function selectBalancedCandidate(pool: Candidate[], counts: ExposureCounts = {}, random = Math.random) {
  const sorted = pool.map((candidate) => ({ candidate, count: counts[candidate.deity_id] ?? { recent_count: 0, total_count: 0, last_shown: 0 }, tie: random() }))
    .sort((a, b) => a.count.recent_count - b.count.recent_count || a.count.total_count - b.count.total_count || b.candidate.score - a.candidate.score || a.tie - b.tie);
  return sorted[0]?.candidate;
}

export function buildExperienceResult(query: string, analysis: Analysis, selected: Candidate, options: {
  engine?: "local" | "llm" | "cached"; modelStatus?: string; balanced?: boolean; persistence?: "d1" | "unavailable" | "offline"; replayed?: boolean;
} = {}): ExperienceResult {
  const deity = deities.find((item) => item.id === selected.deity_id)!;
  const intent = analysis.intents[selected.intent_index] ?? analysis.intents[0];
  const mapping: Mapping = { id: `EXPERIENCE-${intent.category}`, life_domain: intent.category, input_examples: [], normalized_intent: intent.wish,
    routes: [{ target_id: deity.id, relation_level: selected.relation_level, score: selected.score }], clarifying_questions: [], exclusions: [], source_ids: deity.source_ids, review_status: deity.review_status };
  return { query: query.trim().slice(0, 240), mode: "experience", mapping, deity, status: "matched", engine: options.engine ?? "local", message: "愿你心有所定，所行顺遂。",
    reason: buildMatchReason(query, deity, intent.category, selected.relation_level, findNamedDeities(query).some((item) => item.id === deity.id)),
    analysis: { intents: analysis.intents, excluded_categories: analysis.excluded_categories }, candidates: analysis.candidates, relation_level: selected.relation_level,
    selection: { balanced: options.balanced ?? false, persistence: options.persistence ?? "offline", replayed: options.replayed ?? false, window_size: 1000 }, model_status: options.modelStatus ?? "local_fallback" };
}

export function resolveExperienceMatch(query: string, counts: ExposureCounts = {}): ExperienceResult {
  const analysis = buildLocalAnalysis(query);
  const selected = selectBalancedCandidate(getSelectionPool(analysis, query), counts)!;
  return buildExperienceResult(query, analysis, selected);
}

export function getModelCatalogue(counts: ExposureCounts = {}) {
  return deities.map(({ id, canonical_name, tradition, domains }) => ({ id, name: canonical_name, tradition, domains,
    recent_count: counts[id]?.recent_count ?? 0, total_count: counts[id]?.total_count ?? 0 }));
}
