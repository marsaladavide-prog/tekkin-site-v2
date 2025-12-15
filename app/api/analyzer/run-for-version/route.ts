import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

    const profileKey = project.genre || "minimal_deep_tech";
    const mode = project.mix_type || "master";


const analyzerUrl = process.env.TEKKIN_ANALYZER_URL;

if (!analyzerUrl) {
  console.error("[run-analyzer] TEKKIN_ANALYZER_URL mancante");
  return NextResponse.json(
    { error: "Analyzer non configurato sul server" },
    { status: 500 }
  );
}

    const audioPath = version.audio_url as string | null;

    if (!audioPath) {
      return NextResponse.json(
        { error: "Nessun audio_url per questa versione" },
        { status: 400 }
      );
    }

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

    console.log("[run-analyzer] payload ->", JSON.stringify(payload, null, 2));

    console.log("[run-analyzer] Chiamo analyzer:", analyzerUrl);

    const analyzerRes = await fetch(analyzerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-analyzer-secret": process.env.TEKKIN_ANALYZER_SECRET ?? "",
      },
      body: JSON.stringify(payload),
    });

    const raw = await analyzerRes.text();
    console.log("[run-analyzer] status ->", analyzerRes.status);
    console.log("[run-analyzer] raw size ->", raw.length);
    console.log("[run-analyzer] raw head ->", raw.slice(0, 600));

    let result: any = null;
    try {
      result = JSON.parse(raw);
    } catch {
      console.error("[run-analyzer] response not json");
      return NextResponse.json({ error: "Analyzer returned non-JSON" }, { status: 502 });
    }

    const warnings = [
      ...(Array.isArray(result?.warnings) ? result.warnings : []),
      ...(Array.isArray(result?.loudness_stats?.warnings) ? result.loudness_stats.warnings : []),
    ].slice(0, 10);
    console.log("[run-analyzer] warnings ->", warnings);

    const matchRatio =
      typeof result?.model_match?.match_ratio === "number" && Number.isFinite(result.model_match.match_ratio)
        ? result.model_match.match_ratio
        : null;
    const modelMatchPercent = matchRatio == null ? null : Math.round(matchRatio * 100);
    const bandEnergyNorm = (result as any)?.band_energy_norm;
    const hasBandNorm =
      !!bandEnergyNorm && typeof bandEnergyNorm === "object" && Object.keys(bandEnergyNorm).length > 0;

    console.log(
      "[run-analyzer] brief ->",
      JSON.stringify(
        {
          bpm: result?.bpm,
          key: result?.key,
          lufs: result?.loudness_stats?.integrated_lufs,
          lra: result?.loudness_stats?.lra,
          sample_peak_db: result?.loudness_stats?.sample_peak_db,
          spectral_keys: Object.keys(result?.spectral ?? {}),
          has_band_norm: hasBandNorm,
          model_match_percent: modelMatchPercent,
          model_match: result?.model_match ?? null,
          arrays_blob_path: result?.arrays_blob_path ?? null,
          arrays_blob_size_bytes: result?.arrays_blob_size_bytes ?? null,
        },
        null,
        2
      )
    );

    console.log("[run-analyzer] keys:", Object.keys(result || {}));
    console.log("[run-analyzer] lufs:", result?.loudness_stats?.integrated_lufs);
    console.log("[run-analyzer] model_match:", result?.model_match);
    console.log("[run-analyzer] spectral keys:", Object.keys(result?.spectral ?? {}));
    // const rawPretty = JSON.stringify(result, null, 2);
    // console.log("[run-analyzer] full (first 8000 chars):\n", rawPretty.slice(0, 8000));

    if (!analyzerRes.ok) {
      console.error("[run-analyzer] Analyzer error response:", analyzerRes.status);
      return NextResponse.json(
        { error: "Errore dall'Analyzer", detail: raw.slice(0, 8000) || null },
        { status: 502 }
      );
    }

    const {
      overall_score,
      lufs,
      bpm,
      spectral_centroid_hz,
      spectral_rolloff_hz,
      spectral_bandwidth_hz,
      spectral_flatness,
      zero_crossing_rate,
      feedback,
      fix_suggestions,
      reference_ai,
      waveform_peaks,
      waveform_duration,
      waveform_bands,
    } = result;

    const analyzerBpm =
      typeof bpm === "number" && Number.isFinite(bpm) ? Math.round(bpm) : null;

    const { data: updatedVersion, error: updateError } = await supabase
      .from("project_versions")
      .update({
        lufs,
        overall_score,
        feedback,
        analyzer_bpm: analyzerBpm,
        analyzer_spectral_centroid_hz: spectral_centroid_hz ?? null,
        analyzer_spectral_rolloff_hz: spectral_rolloff_hz ?? null,
        analyzer_spectral_bandwidth_hz: spectral_bandwidth_hz ?? null,
        analyzer_spectral_flatness: spectral_flatness ?? null,
        analyzer_zero_crossing_rate: zero_crossing_rate ?? null,
        fix_suggestions: fix_suggestions ?? null,
        analyzer_reference_ai: reference_ai ?? null,
        waveform_peaks: Array.isArray(waveform_peaks) ? waveform_peaks : null,
        waveform_duration:
          typeof waveform_duration === "number" && Number.isFinite(waveform_duration)
            ? waveform_duration
            : null,
        waveform_bands: waveform_bands ?? null,
      })
      .eq("id", version.id)
      .select(
        "id, version_name, created_at, audio_url, lufs, overall_score, feedback, analyzer_bpm, analyzer_spectral_centroid_hz, analyzer_spectral_rolloff_hz, analyzer_spectral_bandwidth_hz, analyzer_spectral_flatness, analyzer_zero_crossing_rate, analyzer_reference_ai, fix_suggestions, waveform_peaks, waveform_duration, waveform_bands"
      )
      .single();

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
