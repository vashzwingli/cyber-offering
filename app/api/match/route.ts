import { NextResponse } from "next/server";
import { resolveMatch } from "@/lib/match";
import { matchExperience, RequestConflictError } from "@/lib/match-service";
export async function POST(request: Request) {
  let body: { query?: unknown; mode?: unknown; request_id?: unknown } | null;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "请求格式无效" }, { status: 400 }); }
  if (!body || typeof body.query !== "string" || !body.query.trim() || body.query.trim().length > 240)
    return NextResponse.json({ error: "请输入 1 至 240 字的行为或场景" }, { status: 400 });
  const query = body.query.trim();
  const mode = body.mode ?? "experience";
  if (mode !== "experience" && mode !== "research" && mode !== "verified")
    return NextResponse.json({ error: "匹配模式无效" }, { status: 400 });
  if (mode !== "experience") return NextResponse.json(resolveMatch(query, mode));
  const requestId = body.request_id ?? request.headers.get("Idempotency-Key") ?? crypto.randomUUID();
  if (typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(requestId))
    return NextResponse.json({ error: "request_id 格式无效" }, { status: 400 });
  try { return NextResponse.json({ ...await matchExperience(query, requestId), request_id: requestId }); }
  catch (error) {
    if (error instanceof RequestConflictError) return NextResponse.json({ error: "同一 request_id 不能用于不同内容" }, { status: 409 });
    throw error;
  }
}
