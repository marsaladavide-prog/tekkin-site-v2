import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { AnalyzerResult } from "@/types/analyzer";
import { buildAnalyzerUpdatePayload } from "@/lib/analyzer/handleAnalyzerResult";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[run-analyzer] Auth error:", authError);
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    const requestBody = await req.json().catch(() => null);
    const versionId = requestBody?.version_id as string | undefined;

    if (!versionId) {
      return NextResponse.json(
        { error: "version_id mancante" },
        { status: 400 }
      );
    }

    // 1. recupero la versione
    const { data: version, error: versionError } = await supabase
      .from("project_versions")
      .select("id, project_id, audio_url, version_name")
      .eq("id", versionId)
      .single();

    if (versionError || !version) {
      console.error("[run-analyzer] Version not found:", versionError);
      return NextResponse.json(
        { error: "Version non trovata" },
        { status: 404 }
      );
    }

        // 1b. recupero il project per avere genre e mix_type
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, genre, mix_type")
      .eq("id", version.project_id)
      .single();

    if (projectError || !project) {
      console.error("[run-analyzer] Project not found:", projectError);
      return NextResponse.json(
        { error: "Project non trovato" },
        { status: 404 }
      );
    }

    // profilo di analisi e modalità (master/premaster)
    const profileKey = project.genre || "minimal_deep_tech";
    const mode = project.mix_type || "master";


    const analyzerUrl =
      process.env.TEKKIN_ANALYZER_URL || "http://127.0.0.1:8000/analyze";

    if (!analyzerUrl) {
      console.error("[run-analyzer] TEKKIN_ANALYZER_URL mancante");
      return NextResponse.json(
        { error: "Analyzer non configurato sul server" },
        { status: 500 }
      );
    }

    const audioPath = version.audio_url;
    if (!audioPath) {
      return NextResponse.json(
        { error: "Nessun audio_url per questa versione" },
        { status: 400 }
      );
    }

    // 2. Signed URL se serve
    let audioUrl = audioPath;
    if (!audioPath.startsWith("http")) {
      const { data: signed, error: signedError } = await supabase.storage
        .from("tracks")
        .createSignedUrl(audioPath, 60 * 30);

      if (signedError || !signed?.signedUrl) {
        console.error("[run-analyzer] Signed URL error:", signedError);
        return NextResponse.json(
          { error: "Impossibile generare URL audio firmata" },
          { status: 500 }
        );
      }

      audioUrl = signed.signedUrl;
    }

const payload = {
  version_id: version.id,
  project_id: version.project_id,
  audio_url: audioUrl,
  profile_key: profileKey,
  mode,
  lang: "it",
};

    console.log("[run-analyzer] Chiamo analyzer:", analyzerUrl, payload);

    const analyzerRes = await fetch(analyzerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-analyzer-secret": process.env.TEKKIN_ANALYZER_SECRET ?? "",
      },
      body: JSON.stringify(payload),
    });

    if (!analyzerRes.ok) {
      const text = await analyzerRes.text().catch(() => "");
      console.error(
        "[run-analyzer] Analyzer error response:",
        analyzerRes.status,
        text
      );
      return NextResponse.json(
        { error: "Errore dall'Analyzer", detail: text || null },
        { status: 502 }
      );
    }

    const raw = await analyzerRes.json().catch(() => null);

    console.log("[run-analyzer] Analyzer result JSON:", raw);

    if (!raw) {
      return NextResponse.json(
        { error: "Risposta Analyzer non valida" },
        { status: 500 }
      );
    }

    const result = raw as AnalyzerResult;

    // mapping centralizzato
    const updatePayload = buildAnalyzerUpdatePayload(result);
    const payloadWithoutKey = ((): Omit<typeof updatePayload, "analyzer_key"> => {
      const { analyzer_key, ...rest } = updatePayload;
      return rest;
    })();

    const versionSelectFieldsBase = [
      "id",
      "version_name",
      "created_at",
      "audio_url",
      "lufs",
      "sub_clarity",
      "hi_end",
      "dynamics",
      "stereo_image",
      "tonality",
      "overall_score",
      "feedback",
      "analyzer_bpm",
      "analyzer_spectral_centroid_hz",
      "analyzer_spectral_rolloff_hz",
      "analyzer_spectral_bandwidth_hz",
      "analyzer_spectral_flatness",
      "analyzer_zero_crossing_rate",
      "analyzer_reference_ai",
      "analyzer_mix_v1",
      "fix_suggestions",
      "analyzer_json",
    ];

    const buildSelectFields = (includeKey: boolean) =>
      includeKey
        ? [...versionSelectFieldsBase, "analyzer_key"]
        : versionSelectFieldsBase;

    const hasAnalyzerKeyError = (error: any) => {
      if (!error) return false;
      const message =
        `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
      return message.includes("analyzer_key");
    };

    const updateVersion = async (includeKey: boolean) =>
      supabase
        .from("project_versions")
        .update(includeKey ? updatePayload : payloadWithoutKey)
        .eq("id", version.id)
        .select(buildSelectFields(includeKey).join(", "))
        .single();

    let includeAnalyzerKey = true;
    let updateResult = await updateVersion(includeAnalyzerKey);

    if (
      updateResult.error &&
      hasAnalyzerKeyError(updateResult.error) &&
      includeAnalyzerKey
    ) {
      console.warn(
        "[run-analyzer] analyzer_key column missing, retrying without it"
      );
      includeAnalyzerKey = false;
      updateResult = await updateVersion(includeAnalyzerKey);
    }

    const { data: updatedVersion, error: updateError } = updateResult;

    if (updateError || !updatedVersion) {
      console.error("[run-analyzer] Update version error:", updateError);
      return NextResponse.json(
        { error: "Errore aggiornando i dati di analisi" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        version: updatedVersion,
        analyzer_result: result,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Unexpected run-analyzer error:", err);
    return NextResponse.json(
      { error: "Errore inatteso Analyzer" },
      { status: 500 }
    );
  }
}
