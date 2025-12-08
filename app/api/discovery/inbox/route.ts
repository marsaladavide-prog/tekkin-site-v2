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

    const projectIds = [...new Set(requests.map((r) => r.project_id))];

    const { data: projectRows, error: projectError } = await supabase
      .from("projects")
      .select("id, title")
      .in("id", projectIds);

    if (projectError) {
      console.error("[discovery][inbox] projectError", projectError);
      return NextResponse.json(
        { error: "Errore caricando i progetti" },
        { status: 500 }
      );
    }

    const projectById = new Map((projectRows ?? []).map((p) => [p.id, p]));

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
        return {
          request_id: r.id,
          kind: r.kind,
          project_id: r.project_id,
          project_title: projectById.get(r.project_id)?.title ?? "Project",
          // qui NON restituiamo sender_id
          genre: t?.genre ?? null,
          overall_score: t?.overall_score ?? null,
          mix_score: t?.mix_score ?? null,
          master_score: t?.master_score ?? null,
          bass_energy: t?.bass_energy ?? null,
          has_vocals: t?.has_vocals ?? null,
          bpm: t?.bpm ?? null,
          message: r.message,
        };
      });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[discovery][inbox] unexpected", err);
    return NextResponse.json(
      { error: "Errore inatteso" },
      { status: 500 }
    );
  }
}
