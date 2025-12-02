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

    // corpo della richiesta dal client
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

    // 2. Se è già una URL completa, usala; altrimenti crea una signed URL dal bucket "tracks"
    let audioUrl = audioPath;

    if (!audioPath.startsWith("http")) {
      const { data: signed, error: signedError } = await supabase.storage
        .from("tracks")
        .createSignedUrl(audioPath, 60 * 30); // 30 minuti

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

    const result = await analyzerRes.json().catch(() => null);

    console.log("[run-analyzer] Analyzer result JSON:", result);

    if (!result) {
      return NextResponse.json(
        { error: "Risposta Analyzer non valida" },
        { status: 500 }
      );
    }

    const {
      lufs,
      sub_clarity,
      hi_end,
      dynamics,
      stereo_image,
      tonality,
      overall_score,
      feedback,
      bpm,
      spectral_centroid_hz,
      spectral_rolloff_hz,
      spectral_bandwidth_hz,
      spectral_flatness,
      zero_crossing_rate,
      fix_suggestions,
      reference_ai,
    } = result;

    // 3. aggiorno la versione con i dati dell'analisi
    const { data: updatedVersion, error: updateError } = await supabase
      .from("project_versions")
      .update({
        lufs,
        sub_clarity,
        hi_end,
        dynamics,
        stereo_image,
        tonality,
        overall_score,
        feedback,

        analyzer_bpm: bpm ?? null,
        analyzer_spectral_centroid_hz: spectral_centroid_hz ?? null,
        analyzer_spectral_rolloff_hz: spectral_rolloff_hz ?? null,
        analyzer_spectral_bandwidth_hz: spectral_bandwidth_hz ?? null,
        analyzer_spectral_flatness: spectral_flatness ?? null,
        analyzer_zero_crossing_rate: zero_crossing_rate ?? null,
        fix_suggestions: fix_suggestions ?? null,
        analyzer_reference_ai: reference_ai ?? null,
      })
      .eq("id", version.id)
      .select(
        "id, version_name, created_at, audio_url, lufs, sub_clarity, hi_end, dynamics, stereo_image, tonality, overall_score, feedback, analyzer_bpm, analyzer_spectral_centroid_hz, analyzer_spectral_rolloff_hz, analyzer_spectral_bandwidth_hz, analyzer_spectral_flatness, analyzer_zero_crossing_rate, analyzer_reference_ai"
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
