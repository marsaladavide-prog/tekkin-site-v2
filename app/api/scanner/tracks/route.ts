// app/api/scanner/tracks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const searchParams = req.nextUrl.searchParams;
    const genre = searchParams.get("genre");
    const minScore = searchParams.get("min_score");
    const vocals = searchParams.get("vocals"); // "with" | "without"
    const bpmFrom = searchParams.get("bpm_from");
    const bpmTo = searchParams.get("bpm_to");

    let query = supabase
      .from("discovery_tracks")
      .select("*")
      .eq("is_enabled", true);

    if (genre) {
      query = query.eq("genre", genre);
    }

    if (minScore) {
      const scoreVal = Number(minScore);
      if (!Number.isNaN(scoreVal)) {
        query = query.gte("overall_score", scoreVal);
      }
    }

    if (vocals === "with") {
      query = query.eq("has_vocals", true);
    } else if (vocals === "without") {
      query = query.eq("has_vocals", false);
    }

    if (bpmFrom) {
      const val = Number(bpmFrom);
      if (!Number.isNaN(val)) query = query.gte("bpm", val);
    }

    if (bpmTo) {
      const val = Number(bpmTo);
      if (!Number.isNaN(val)) query = query.lte("bpm", val);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[scanner][tracks] error", error);
      return NextResponse.json(
        { error: "Errore caricando le tracce Scanner" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (err) {
    console.error("[scanner][tracks] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
