import { NextResponse } from "next/server";
import { matchStats } from "@/lib/match-service";
import { getModelCatalogue } from "@/lib/experience-match";
export async function GET() {
  const state = await matchStats();
  return NextResponse.json({ persistence: state.persistence, window_size: state.window_size, deities: getModelCatalogue(state.counts) }, { headers: { "Cache-Control": "no-store" } });
}
