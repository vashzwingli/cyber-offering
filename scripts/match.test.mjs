import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMatch } from "../lib/match.ts";
import mappings from "../data/action-mappings.json" with { type: "json" };
import deities from "../data/deities.json" with { type: "json" };
import { existsSync } from "node:fs";

test("direct research matches retain their registered targets", () => {
  for (const [query, id] of [["我想考研顺利", "DAO-009"], ["我想做生意", "DAO-008"], ["我想谈恋爱", "FOLK-005"], ["装修施工", "FOLK-007"]]) {
    const result = resolveMatch(query);
    assert.equal(result.deity?.id, id, query);
    assert.equal(result.mode, "research");
  }
});
test("analogies, symbols and unsupported activities never become recommendations", () => {
  for (const query of ["写代码", "网络安全软件", "拍视频", "流浪动物救助", "体育比赛", "炒股求财", "海边拍鸟", "买房", "开车", "不想恋爱", "考试同时想做生意", "嗯", "我", ""]) {
    const result = resolveMatch(query);
    assert.equal(result.deity, null, query);
  }
});
test("marine safety requires a marine context, never just a bird name", () => {
  assert.equal(resolveMatch("海边拍海鸟").deity, null);
  assert.equal(resolveMatch("坐船出海看鲸鱼").deity?.id, "DAO-014");
});
test("contextual matches ask for missing information", () => {
  for (const query of ["登山", "搬家", "音乐会", "怀孕"]) {
    const result = resolveMatch(query);
    assert.equal(result.status, "needs_context", query);
    assert.equal(result.deity, null);
    assert.ok(result.mapping.clarifying_questions.length);
  }
});
test("verified mode excludes every unfinished mapping and entity", () => {
  for (const mapping of mappings) {
    const result = resolveMatch(mapping.input_examples[0], "verified", { mappingId: mapping.id });
    if (mapping.review_status !== "verified") assert.equal(result.deity, null, mapping.id);
  }
});
test("a model's explicit null and an unknown id remain no-match", () => {
  for (const mappingId of [null, "DOES-NOT-EXIST"]) {
    const result = resolveMatch("我想考研顺利", "research", { mappingId });
    assert.equal(result.deity, null);
    assert.equal(result.mapping.id, "NO-MATCH");
  }
});
test("every displayed concept image exists and references stay inside the data", () => {
  for (const deity of deities) assert.ok(existsSync(new URL(`../public/images/deities/${deity.id}.png`, import.meta.url)), deity.id);
  for (const mapping of mappings) for (const route of mapping.routes) {
    if (route.target_id) assert.ok(deities.some((deity) => deity.id === route.target_id), route.target_id);
  }
});
