import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const kind = searchParams.get("kind");
    const genre = searchParams.get("genre");
    const hasVocalsParam = searchParams.get("has_vocals");
    const minScoreParam = searchParams.get("min_score");

    const hasVocals =
      hasVocalsParam === null ? null : hasVocalsParam === "true";

    const minScore = minScoreParam ? Number(minScoreParam) : null;

    // 1) prendo richieste pending per questo utente
    let reqQuery = supabase
      .from("discovery_requests")
      .select("*")
      .eq("receiver_id", user.id)
      .eq("status", "pending");

    if (kind) {
      reqQuery = reqQuery.eq("kind", kind);
    }

    const { data: requests, error: reqError } = await reqQuery;

    if (reqError) {
      console.error("[discovery][inbox] reqError", reqError);
      return NextResponse.json(
        { error: "Errore caricando le richieste" },
        { status: 500 }
      );
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // 2) prendo i discovery_tracks per i project_id coinvolti
    const projectIds = [...new Set(requests.map((r) => r.project_id))];

    let trackQuery = supabase
      .from("discovery_tracks")
      .select("*")
      .in("project_id", projectIds)
      .eq("is_enabled", true);

    if (genre) {
      trackQuery = trackQuery.eq("genre", genre);
    }

    if (hasVocals !== null) {
      trackQuery = trackQuery.eq("has_vocals", hasVocals);
    }

    if (minScore !== null && !Number.isNaN(minScore)) {
      trackQuery = trackQuery.gte("overall_score", minScore);
    }

    const { data: tracks, error: trackError } = await trackQuery;

    if (trackError) {
      console.error("[discovery][inbox] trackError", trackError);
      return NextResponse.json(
        { error: "Errore caricando le tracce discovery" },
        { status: 500 }
      );
    }

    const trackByProjectId = new Map(
      (tracks ?? []).map((t) => [t.project_id, t])
    );

    const result = requests
      .map((r) => {
        const t = trackByProjectId.get(r.project_id);
        if (!t) return null;

        return {
          request_id: r.id,
          kind: r.kind,
          project_id: r.project_id,
          // qui NON restituiamo sender_id
          genre: t.genre,
          overall_score: t.overall_score,
          mix_score: t.mix_score,
          master_score: t.master_score,
          bass_energy: t.bass_energy,
          has_vocals: t.has_vocals,
          bpm: t.bpm,
          message: r.message,
        };
      })
      .filter(Boolean);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[discovery][inbox] unexpected", err);
    return NextResponse.json(
      { error: "Errore inatteso" },
      { status: 500 }
    );
  }
}
