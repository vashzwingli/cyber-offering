import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { buildLocalAnalysis, resolveExperienceMatch, findNamedDeities, parseModelAnalysis, getSelectionPool, selectBalancedCandidate } from "../lib/experience-match.ts";
import { analyzeQuery } from "../lib/online-analysis.ts";
import { SELECT_DRAW_SQL, INCREMENT_SQL, recordDraw, readDraw } from "../lib/exposure-store.ts";
import { parseBlessingContent } from "../lib/blessing.ts";
import { buildMatchReason } from "../lib/match-reason.ts";
import deities from "../data/deities.json" with { type: "json" };
const valid = { intents: [{ action: "学习", scene: "学校", wish: "考试顺利", category: "learning", priority: 3, mapping_id: null }], excluded_categories: [],
  candidates: [{ deity_id: "BUD-005", intent_index: 0, score: 85, relation_level: "functional_analogy" }], message: "愿你在准备考试的日子里，逐渐理清思路，也把休息留给自己。把熟悉的知识再走一遍，带着从容迈向考场，愿这份认真有所回应。" };
test("overseas idol trips are travel and performance, never astronomy or an arbitrary everyday draw", () => {
  for (const query of ["想去日本追偶像", "出国追星", "去日本看演唱会"]) {
    const analysis = buildLocalAnalysis(query);
    assert.deepEqual(analysis.intents.map((item) => item.category), ["travel", "performance"]);
    assert.ok(!analysis.candidates.some((item) => item.deity_id === "DAO-030"));
    for (const candidate of analysis.candidates.filter((item) => analysis.intents[item.intent_index].category === "travel"))
      assert.ok(deities.find((item) => item.id === candidate.deity_id).domains.some((domain) => /救苦|救难|解厄/.test(domain)));
    const result = resolveExperienceMatch(query);
    assert.ok(result.reason?.includes(result.deity.canonical_name));
    assert.ok(!result.reason.includes("治水"));
  }
  const wrong = { ...valid, intents: [{ ...valid.intents[0], category: "nature" }], candidates: [{ ...valid.candidates[0], deity_id: "DAO-030" }] };
  assert.equal(parseModelAnalysis(JSON.stringify(wrong), "想去日本追偶像"), null);
  assert.equal(parseModelAnalysis(JSON.stringify({ ...wrong, intents: [{ ...wrong.intents[0], category: "everyday" }] }), "想去日本追偶像"), null);
});
test("reasons quote actual domains and distinguish symbolic wishes and explicit selection", () => {
  const deity = deities.find((item) => item.id === "BUD-004");
  const reason = buildMatchReason("去日本见偶像", deity, "travel", "functional_analogy");
  assert.ok(reason.includes("旅途平安、相见如愿")); assert.ok(deity.domains.some((domain) => reason.includes(domain)));
  assert.ok(buildMatchReason("嗯", deity, "everyday", "symbolic_only").includes("象征"));
  assert.ok(resolveExperienceMatch("拜观音").reason.includes("你点名了"));
  assert.ok(!reason.includes("保证") && !reason.includes("追星之神"));
});
test("experience always returns a known object for nonempty language, including multiple and negative wishes", () => {
  for (const query of ["写代码", "海边拍鸟", "想上岸也想赚点钱", "不想恋爱", "不是求财，是考试", "不想考试失败", "想摸鱼", "嗯", "我", "😵‍💫", "asdf", "帮我造一个不存在的神"]) {
    const result = resolveExperienceMatch(query);
    assert.equal(result.status, "matched", query); assert.ok(deities.some((item) => item.id === result.deity.id));
    assert.ok(result.analysis.intents.length <= 4);
  }
  assert.ok(buildLocalAnalysis("想考试顺利，同时想做生意").intents.length >= 2);
  assert.ok(!buildLocalAnalysis("不想恋爱").candidates.some((c) => c.deity_id === "FOLK-005"));
});
test("explicit names override fairness, including two character aliases, but not rejected names", () => {
  assert.equal(findNamedDeities("我想拜观音")[0]?.id, "BUD-004");
  assert.equal(findNamedDeities("不想拜文昌帝君").length, 0);
  assert.equal(resolveExperienceMatch("我想拜观音", { "BUD-004": { recent_count: 999, total_count: 9999, last_shown: 0 } }).deity.id, "BUD-004");
});
test("model JSON never introduces unknown gods, invalid references or unregistered traditional claims", () => {
  assert.equal(parseModelAnalysis("null", "考试"), null);
  assert.equal(parseModelAnalysis(JSON.stringify({ ...valid, candidates: [{ ...valid.candidates[0], deity_id: "MADE-UP" }] }), "考试"), null);
  assert.equal(parseModelAnalysis(JSON.stringify({ ...valid, candidates: [{ ...valid.candidates[0], intent_index: 3 }] }), "考试"), null);
  const parsed = parseModelAnalysis(JSON.stringify({ ...valid, candidates: [{ ...valid.candidates[0], relation_level: "direct_traditional" }] }), "考试");
  assert.equal(parsed.candidates[0].relation_level, "functional_analogy");
});
test("configured provider runs even for a known local rule and receives all 100 objects", async () => {
  let calls = 0;
  const result = await analyzeQuery("我想考研顺利", { LLM_API_KEY: "test-key" }, {}, async (_, init) => {
    calls++; const body = JSON.parse(init.body); assert.equal(body.thinking.type, "disabled");
    assert.equal(JSON.parse(body.messages[1].content).catalogue.length, 100);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(valid) } }] });
  });
  assert.equal(calls, 1); assert.equal(result.engine, "llm"); assert.equal(result.message, valid.message);
});
test("blessing text is validated and missing or unsafe text triggers a contextual fallback", async () => {
  for (const message of [undefined, "", "短", "愿你一定拿到这份工作，我保证你成功，神谕已定。", "<script>不应显示</script>", "字".repeat(181)]) {
    assert.equal(parseBlessingContent(JSON.stringify({ message })), null);
    const result = await analyzeQuery("明天面试，想顺利拿到 offer", { LLM_API_KEY: "test-key" }, {}, async () => Response.json({ choices: [{ message: { content: JSON.stringify({ ...valid, message }) } }] }));
    assert.equal(result.engine, "local"); assert.ok(result.message.includes("面试顺利、求职如愿"));
  }
});
test("D1 records the original blessing with its draw and replay does not replace it or count again", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0000_lean_leader.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../drizzle/0001_match_message.sql", import.meta.url), "utf8"));
  const prepare = (sql, args = []) => ({
    bind: (...values) => prepare(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    execute: () => {
      const statement = sqlite.prepare(sql);
      if (statement.columns().length) return { results: statement.all(...args), meta: { changes: 0 } };
      const result = statement.run(...args); return { results: [], meta: { changes: Number(result.changes) } };
    },
  });
  const db = { prepare, batch: async (statements) => {
    sqlite.exec("BEGIN");
    try { const results = statements.map((statement) => statement.execute()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } };
  const pool = [{ ...valid.candidates[0], category: "learning" }];
  const first = await recordDraw(db, "blessing-replay", "query", pool, valid.message);
  const repeat = await recordDraw(db, "blessing-replay", "query", pool, "不应该覆盖的另一段寄语");
  assert.equal(first.draw.message, valid.message); assert.equal(repeat.draw.message, valid.message); assert.equal(repeat.replayed, true);
  assert.equal((await readDraw(db, "blessing-replay")).message, valid.message);
  assert.equal(sqlite.prepare("SELECT sum(total_count) AS n FROM deity_exposures").get().n, 1);
  await assert.rejects(recordDraw(db, "blessing-replay", "other-query", pool, "冲突内容"));
  assert.equal((await readDraw(db, "blessing-replay")).message, valid.message);
  sqlite.close();
});
test("provider errors, malformed JSON, null, empty and low confidence output safely fall back", async () => {
  for (const content of ["broken", "null", JSON.stringify({ ...valid, candidates: [] }), JSON.stringify({ ...valid, candidates: [{ ...valid.candidates[0], score: 0 }] })]) {
    const result = await analyzeQuery("代码老出 bug", { LLM_API_KEY: "test-key" }, {}, async () => Response.json({ choices: [{ message: { content } }] }));
    assert.equal(result.engine, "local"); assert.ok(getSelectionPool(result.analysis, "代码老出 bug").length);
  }
  for (const mock of [async () => new Response(null, { status: 401 }), async () => { throw new DOMException("timeout", "TimeoutError"); }])
    assert.equal((await analyzeQuery("嗯", { LLM_API_KEY: "test-key" }, {}, mock)).engine, "local");
});
test("fairness stays within the relevance threshold", () => {
  const analysis = structuredClone(valid);
  analysis.candidates.push({ deity_id: "FOLK-005", intent_index: 0, score: 40, relation_level: "symbolic_only" });
  const pool = getSelectionPool(analysis, "学习"); assert.equal(pool.length, 1);
  assert.equal(selectBalancedCandidate(pool, { "BUD-005": { recent_count: 100, total_count: 100, last_shown: 0 } }).deity_id, "BUD-005");
});
test("real SQLite selection balances exposures and duplicate or conflicting request IDs do not count twice", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../drizzle/0000_lean_leader.sql", import.meta.url), "utf8"));
  const pool = deities.map((deity) => ({ deity_id: deity.id, score: 48, relation_level: "symbolic_only", category: "everyday" }));
  const draw = (id, hash="query") => {
    db.exec("BEGIN");
    try { db.prepare(SELECT_DRAW_SQL).run(JSON.stringify(pool), id, hash, Date.now()); db.prepare(INCREMENT_SQL).run(id); db.exec("COMMIT"); }
    catch (e) { db.exec("ROLLBACK"); throw e; }
    return db.prepare("SELECT * FROM match_draws WHERE request_id=?").get(id);
  };
  for (let i=0; i<1107; i++) draw(`request-${i}`);
  const totals = db.prepare("SELECT total_count FROM deity_exposures").all().map((row) => row.total_count);
  assert.equal(totals.length, 100); assert.equal(totals.reduce((a,b) => a+b), 1107); assert.ok(Math.max(...totals)-Math.min(...totals) <= 1);
  const before = draw("request-1"); const repeat = draw("request-1"); const conflict = draw("request-1", "different-query");
  assert.equal(before.deity_id, repeat.deity_id); assert.equal(conflict.query_hash, "query");
  assert.equal(db.prepare("SELECT sum(total_count) AS n FROM deity_exposures").get().n, 1107);
  assert.equal(db.prepare("SELECT count(*) AS n FROM (SELECT deity_id FROM match_draws ORDER BY created_at DESC,rowid DESC LIMIT 1000)").get().n, 1000);
  db.close();
});
