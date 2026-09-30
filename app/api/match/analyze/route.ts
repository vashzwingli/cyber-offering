import { NextResponse } from "next/server";
import { previewMatch } from "@/lib/match-service";
export async function POST(request: Request) {
  let body: { query?: unknown } | null;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "请求格式无效" }, { status: 400 }); }
  if (!body || typeof body.query !== "string" || !body.query.trim() || body.query.trim().length > 240)
    return NextResponse.json({ error: "请输入 1 至 240 字的行为或场景" }, { status: 400 });
  return NextResponse.json(await previewMatch(body.query.trim()));
}
