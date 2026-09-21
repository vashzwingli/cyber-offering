import { NextResponse } from "next/server";

import mappingsJson from "@/data/action-mappings.json";
import deitiesJson from "@/data/deities.json";
import { findRuleMappingId } from "@/lib/intent-router";

type Mapping = (typeof mappingsJson)[number];
type Deity = (typeof deitiesJson)[number];

function similarity(query: string, mapping: Mapping) {
  const normalized = query.replace(/[，。！？、\s]/g, "").toLowerCase();
  const corpus = [
    ...mapping.input_examples,
    mapping.normalized_intent,
    mapping.life_domain,
  ]
    .join("")
    .replace(/[，。！？、\s]/g, "")
    .toLowerCase();

  if (mapping.input_examples.some((item) => normalized.includes(item) || item.includes(normalized))) {
    return 100;
  }

  const removeFillers = (value: string) => value.replace(/我|想|要|准备|近期|第一次|去|做|制作|希望|参与|开始|进行/g, "");
  const semanticQuery = removeFillers(normalized) || normalized;
  const semanticCorpus = removeFillers(corpus);
  let score = 0;
  for (let index = 0; index < semanticQuery.length - 1; index += 1) {
    if (semanticCorpus.includes(semanticQuery.slice(index, index + 2))) score += 8;
  }
  for (const character of new Set(semanticQuery)) {
    if (semanticCorpus.includes(character)) score += 1;
  }
  return score;
}

function noMatch() {
  return {
    id: "NO-MATCH",
    life_domain: "未分类",
    input_examples: [],
    normalized_intent: "未在当前行为映射库中找到可靠对应",
    routes: [{ target_id: null, relation_level: "no_match", score: 0 }],
    clarifying_questions: ["可以补充具体行为、场景和希望获得的帮助吗？"],
    exclusions: ["不根据谐音、动物名、法器或单一造像元素猜测神职"],
    source_ids: [],
    review_status: "verified",
  };
}

function createMessage(mapping: ReturnType<typeof noMatch> | Mapping, deity: Deity | null) {
  if (!deity) {
    return "此事在现有资料中没有可信的传统直配。不妄指神职，也是一种敬慎。";
  }
  return `所求关乎“${mapping.normalized_intent}”。愿你先尽人事、守住分寸，再以此礼整理心意。`;
}

function resolveResult(
  query: string,
  mappingId?: string,
  engine: "local" | "llm" = "local",
  llmMessage?: string,
) {
  const ranked = [...mappingsJson].sort((a, b) => similarity(query, b) - similarity(query, a));
  const ruleId = findRuleMappingId(query);
  const selected = mappingId
    ? mappingsJson.find((mapping) => mapping.id === mappingId)
    : mappingsJson.find((mapping) => mapping.id === ruleId) ??
      (similarity(query, ranked[0]) >= 16 ? ranked[0] : undefined);
  const mapping = selected ?? noMatch();
  const route = mapping.routes[0];
  const deity = route?.target_id
    ? (deitiesJson as Deity[]).find((item) => item.id === route.target_id) ?? null
    : null;

  return {
    query,
    mapping,
    deity,
    engine,
    message: llmMessage?.trim().slice(0, 100) || createMessage(mapping, deity),
  };
}

async function chooseWithLlm(query: string) {
  const endpoint = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!endpoint || !apiKey || !model) return null;

  const candidates = mappingsJson.map((mapping) => ({
    id: mapping.id,
    domain: mapping.life_domain,
    examples: mapping.input_examples,
    intent: mapping.normalized_intent,
  }));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是受约束的传统神职路由器。只能从候选列表选择一个 mapping_id；若没有可靠对应，返回 null。先拆分行为、场景、诉求。不得因动物名、法器、造像元素、谐音或玩梗臆造职掌。另写一句30至60字的现代寄语，不冒充神明口吻，不承诺结果，不替代医疗、法律或现实行动。只输出 JSON：{\"mapping_id\": string|null,\"message\":string}。",
        },
        {
          role: "user",
          content: JSON.stringify({ query, candidates }),
        },
      ],
    }),
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) return null;

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;
  const parsed = JSON.parse(content) as { mapping_id?: string | null; message?: string };
  return {
    mappingId: parsed.mapping_id && mappingsJson.some((item) => item.id === parsed.mapping_id)
      ? parsed.mapping_id
      : null,
    message: typeof parsed.message === "string" ? parsed.message : undefined,
  };
}

export async function POST(request: Request) {
  let query = "";
  try {
    const body = await request.json() as { query?: unknown };
    query = typeof body.query === "string" ? body.query.trim().slice(0, 240) : "";
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: "请输入具体行为或场景" }, { status: 400 });
  }

  try {
    const llmResult = await chooseWithLlm(query);
    if (llmResult) {
      return NextResponse.json(resolveResult(query, llmResult.mappingId ?? undefined, "llm", llmResult.message));
    }
  } catch {
    // External model failures deliberately fall through to the evidence-bound local router.
  }

  return NextResponse.json(resolveResult(query));
}
