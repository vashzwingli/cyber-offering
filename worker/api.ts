import { matchExperience, matchStats, matchStatus, previewMatch, RequestConflictError } from "../lib/match-service";
import { resolveMatch } from "../lib/match";
import { getModelCatalogue } from "../lib/experience-match";
import { MATCH_PROMPT_VERSION } from "../lib/match-prompt";
import type { LlmEnvironment } from "../lib/online-analysis";
export type ApiEnvironment = LlmEnvironment & { DB?: D1Database; ALLOWED_ORIGINS: string; MATCH_RATE_LIMITER?: RateLimit };

export default {
  async fetch(request: Request, env: ApiEnvironment): Promise<Response> {
    const origin = request.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean);
    const path = new URL(request.url).pathname;
    const cors = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
    if (origin && !allowed.includes(origin)) return Response.json({ error: "此来源未获允许" }, { status: 403 });
    if (origin) {
      cors.set("Access-Control-Allow-Origin", origin);
      cors.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      cors.set("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key");
    }
    const json = (data: unknown, status = 200) => Response.json(data, { status, headers: cors });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET" && path === "/api/match/status")
      return json({ ...await matchStatus(), prompt_version: MATCH_PROMPT_VERSION });
    if (request.method === "GET" && path === "/api/match/stats") {
      const state = await matchStats();
      return json({ persistence: state.persistence, window_size: state.window_size, deities: getModelCatalogue(state.counts) });
    }
    if (!['/api/match', '/api/match/analyze'].includes(path)) return json({ error: "接口不存在" }, 404);
    if (request.method !== "POST") return json({ error: "请求方法无效" }, 405);
    if (!origin || !allowed.includes(origin)) return json({ error: "请从配置的网站发起请求" }, 403);
    if (env.LLM_API_KEY && !env.MATCH_RATE_LIMITER) return json({ error: "后端限流配置未完成" }, 503);
    if (env.MATCH_RATE_LIMITER) {
      const { success } = await env.MATCH_RATE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") ?? "local" });
      if (!success) { cors.set("Retry-After", "60"); return json({ error: "请求较多，请稍后再试" }, 429); }
    }
    let body: { query?: unknown; mode?: unknown; request_id?: unknown } | null;
    try { body = await request.json(); } catch { return json({ error: "请求格式无效" }, 400); }
    if (!body || typeof body.query !== "string" || !body.query.trim() || body.query.trim().length > 240)
      return json({ error: "请输入 1 至 240 字的行为或场景" }, 400);
    const query = body.query.trim();
    try {
      if (path === "/api/match/analyze") return json(await previewMatch(query));
      const mode = body.mode ?? "experience";
      if (mode !== "experience" && mode !== "research" && mode !== "verified") return json({ error: "匹配模式无效" }, 400);
      if (mode === "research" || mode === "verified") return json(resolveMatch(query, mode));
      const requestId = body.request_id ?? request.headers.get("Idempotency-Key") ?? crypto.randomUUID();
      if (typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(requestId)) return json({ error: "request_id 格式无效" }, 400);
      return json({ ...await matchExperience(query, requestId), request_id: requestId });
    } catch (error) {
      if (error instanceof RequestConflictError) return json({ error: "同一 request_id 不能用于不同内容" }, 409);
      return json({ error: "接口暂不可用，请稍后重试" }, 503);
    }
  },
} satisfies ExportedHandler<ApiEnvironment>;
