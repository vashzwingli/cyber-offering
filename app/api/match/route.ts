import { NextResponse } from "next/server";
import mappings from "@/data/action-mappings.json";
import { resolveMatch, type MatchMode } from "@/lib/match";
import { findRuleMappingId } from "@/lib/intent-router";

export async function POST(request: Request) {
  let query: string;
  let mode: MatchMode;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("query" in body) || typeof body.query !== "string") {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    query = body.query.trim();
    if (!query || query.length > 240) {
      return NextResponse.json({ error: "请输入 1 至 240 字的具体行为或场景" }, { status: 400 });
    }
    const requestedMode = "mode" in body ? body.mode : "research";
    if (requestedMode !== "research" && requestedMode !== "verified") {
      return NextResponse.json({ error: "匹配模式无效" }, { status: 400 });
    }
    mode = requestedMode;
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }

  const local = resolveMatch(query, mode);
  if (findRuleMappingId(query) || local.mapping.id !== "NO-MATCH") return NextResponse.json(local);
  const endpoint = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (endpoint && apiKey && model) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model, temperature: 0, response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "你是受约束的传统神职路由器。只从候选列表选择一个 mapping_id；无对应、否定句或多个独立诉求无法区分时返回 null。先拆分行为、场景、诉求，遵守 exclusions。不得凭动物名、谐音或造像猜测职掌。仅输出 JSON：{\"mapping_id\":string|null}。不得生成神名、尊号、寄语或仪轨。" },
            { role: "user", content: JSON.stringify({ query, candidates: mappings.map(({ id, input_examples, normalized_intent, exclusions }) => ({ id, input_examples, normalized_intent, exclusions })) }) },
          ],
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const parsed = JSON.parse(payload?.choices?.[0]?.message?.content ?? "null");
        if (parsed && (parsed.mapping_id === null || mappings.some((item) => item.id === parsed.mapping_id))) {
          return NextResponse.json(resolveMatch(query, mode, { mappingId: parsed.mapping_id }));
        }
      }
    } catch {
      // External classifier failures use the same evidence-bound local router as the browser.
    }
  }
  return NextResponse.json(local);
}
