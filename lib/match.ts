import mappings from "../data/action-mappings.json" with { type: "json" };
import deities from "../data/deities.json" with { type: "json" };
import { findRuleMappingId } from "./intent-router.ts";

export type MatchMode = "experience" | "research" | "verified";
export type Deity = (typeof deities)[number];
export type Mapping = (typeof mappings)[number];
export type MatchResult = {
  query: string;
  mode: MatchMode;
  mapping: Mapping;
  deity: Deity | null;
  engine: "local" | "llm" | "cached";
  status: "matched" | "no_match" | "unverified" | "needs_context";
  message: string;
};

const noMatch: Mapping = {
  id: "NO-MATCH", life_domain: "未分类", input_examples: [],
  normalized_intent: "未在当前行为映射库中找到可靠对应",
  routes: [{ target_id: null, relation_level: "no_match", score: 0 }],
  clarifying_questions: ["可以补充具体行为、场景和希望获得的帮助吗？"],
  exclusions: ["不根据谐音、动物名、法器或单一造像元素猜测神职"],
  source_ids: [], review_status: "verified",
};

export function resolveMatch(query: string, mode: MatchMode = "research", choice?: { mappingId: string | null }) : MatchResult {
  const normalized = query.trim().slice(0, 240);
  // A model's explicit null must remain a no-match. Never fall back to a guessed deity.
  const ruleId = findRuleMappingId(normalized);
  const mappingId = choice ? choice.mappingId : ruleId;
  const mapping = mappings.find((item) => item.id === mappingId) ??
    (!choice ? mappings.find((item) => item.input_examples.some((example) => example === normalized)) : undefined) ?? noMatch;
  const directRoutes = mapping.routes.filter((route) => route.target_id && route.relation_level === "direct_traditional" && route.score >= 70);
  const eligible = directRoutes.map((route) => deities.find((item) => item.id === route.target_id)).filter((item): item is Deity => !!item);
  const contextual = mapping.routes.some((route) => route.target_id && route.relation_level === "contextual_direct" && route.score >= 70);
  let deity: Deity | null = eligible[0] ?? null;
  let status: MatchResult["status"] = deity ? "matched" : contextual ? "needs_context" : "no_match";
  if (mode === "verified" && mapping.id !== "NO-MATCH" &&
      (mapping.review_status !== "verified" || !eligible.some((item) => item.review_status === "verified"))) {
    deity = null;
    status = "unverified";
  } else if (mode === "verified") {
    deity = eligible.find((item) => item.review_status === "verified") ?? null;
  }
  const message = status === "unverified"
    ? "相关资料尚未完成终审，正典模式暂不推荐。可返回研究预览了解草案。"
    : status === "needs_context"
      ? "这个对应依赖具体地区或传统，请先补充下方语境。"
      : deity
        ? "愿你心有所定，所行顺遂。"
        : "此事在现有资料中没有可信的传统直配。不妄指神职，也是一种敬慎。";
  return { query: normalized, mode, mapping, deity, status, engine: choice ? "llm" : "local", message };
}
