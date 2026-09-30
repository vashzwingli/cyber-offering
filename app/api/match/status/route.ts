import { NextResponse } from "next/server";
import { matchStatus } from "@/lib/match-service";
import { MATCH_PROMPT_VERSION } from "@/lib/match-prompt";
export async function GET() { return NextResponse.json({ ...await matchStatus(), prompt_version: MATCH_PROMPT_VERSION }, { headers: { "Cache-Control": "no-store" } }); }
