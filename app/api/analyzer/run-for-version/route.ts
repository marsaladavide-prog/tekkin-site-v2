import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type AnalyzerResult = {
  lufs?: number | null;
  sub_clarity?: number | null;
  hi_end?: number | null;
  dynamics?: number | null;
  stereo_image?: number | null;
  tonality?: string | null;
  overall_score?: number | null;
  feedback?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Prendo l’utente (solo per sicurezza)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[Analyzer] Auth error:", authError);
      return NextResponse.json({ error: "Auth error" }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 2. Prendo l’id della version dal body o dalla query ?id=...
    const url = new URL(req.url);
    const urlId = url.searchParams.get("id");

    let versionId = urlId;

    if (!versionId) {
      const body = (await req.json().catch(() => null)) as
        | { versionId?: string }
        | null;
      versionId = body?.versionId ?? null;
    }

    if (!versionId) {
      return NextResponse.json(
        { error: "Missing versionId" },
        { status: 400 }
      );
    }

    // 3. Carico la row di project_versions (audio_url + controllo ownership)
    const { data: version, error: versionError } = await supabase
      .from("project_versions")
      .select(
        `
        id,
        project_id,
        audio_url,
        projects!inner (
          user_id
        )
      `
      )
      .eq("id", versionId)
      .single();

    if (versionError || !version) {
      console.error("[Analyzer] project_versions load error:", versionError);
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    // controllo che la versione appartenga all’utente loggato
    const versionOwnerId = (version as any).projects.user_id as string;
    if (versionOwnerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const audioPath = version.audio_url as string | null;

    if (!audioPath) {
      return NextResponse.json(
        { error: "Missing audio_url for this version" },
        { status: 400 }
      );
    }

    // 4. Creo una signed URL per il file nel bucket "tracks"
    const { data: signedData, error: signedError } = await supabase.storage
      .from("tracks")
      .createSignedUrl(audioPath, 60 * 30); // 30 minuti

    if (signedError || !signedData) {
      console.error("[Analyzer] signed URL error:", signedError);
      return NextResponse.json(
        { error: "Failed to create signed URL" },
        { status: 500 }
      );
    }

    const signedUrl = signedData.signedUrl;

    // 5. Chiamo il servizio Python Tekkin Analyzer
    const analyzerUrl = process.env.TEKKIN_ANALYZER_URL;
    const analyzerSecret = process.env.TEKKIN_ANALYZER_SECRET;

    if (!analyzerUrl || !analyzerSecret) {
      console.error("[Analyzer] Missing env TEKKIN_ANALYZER_URL or SECRET");
      return NextResponse.json(
        { error: "Analyzer env not configured" },
        { status: 500 }
      );
    }
const analyzerRes = await fetch(analyzerUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-analyzer-secret": analyzerSecret,
  },
  body: JSON.stringify({
    audio_url: signedUrl,
    lang: "it",
    profile_key: "minimal_deep_tech",
    mode: "master",
    // se nel futuro ti serve, qui puoi passare anche version_id / project_id
  }),
});

    if (!analyzerRes.ok) {
      const text = await analyzerRes.text().catch(() => "");
      console.error(
        "[Analyzer] Python service error:",
        analyzerRes.status,
        text
      );
      return NextResponse.json(
        { error: "Analyzer service failed" },
        { status: 502 }
      );
    }

    const result = (await analyzerRes.json()) as AnalyzerResult;

    // 6. Aggiorno la row di project_versions con i dati dell’Analyzer
    const { data: updatedVersion, error: updateError } = await supabase
      .from("project_versions")
      .update({
        lufs:
          typeof result.lufs === "number"
            ? result.lufs
            : null,
        sub_clarity:
          typeof result.sub_clarity === "number"
            ? result.sub_clarity
            : null,
        hi_end:
          typeof result.hi_end === "number"
            ? result.hi_end
            : null,
        dynamics:
          typeof result.dynamics === "number"
            ? result.dynamics
            : null,
        stereo_image:
          typeof result.stereo_image === "number"
            ? result.stereo_image
            : null,
        tonality:
          typeof result.tonality === "string"
            ? result.tonality
            : null,
        overall_score:
          typeof result.overall_score === "number"
            ? result.overall_score
            : null,
        feedback:
          typeof result.feedback === "string"
            ? result.feedback
            : null,
      })
      .eq("id", versionId)
      .select()
      .single();

    if (updateError) {
      console.error("[Analyzer] update version error:", updateError);
      return NextResponse.json(
        { error: "Failed to update project_version" },
        { status: 500 }
      );
    }

    return NextResponse.json(
  {
    ok: true,
    overall_score: result.overall_score
  },
  { status: 200 }
);
  } catch (err) {
    console.error("[Analyzer] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}
