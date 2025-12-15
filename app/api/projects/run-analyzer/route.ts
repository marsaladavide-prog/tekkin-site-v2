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
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const requestBody = await req.json().catch(() => null);
    const versionId =
      typeof requestBody?.version_id === "string" && requestBody.version_id.trim()
        ? requestBody.version_id.trim()
        : null;

    if (!versionId) {
      return NextResponse.json({ error: "version_id mancante" }, { status: 400 });
    }

    // 1) Recupero versione
const { data: version, error: versionError } = await supabase
  .from("project_versions")
  .select("id, project_id, audio_url, audio_path, version_name")
  .eq("id", versionId)
  .maybeSingle();

    if (versionError || !version) {
      console.error("[run-analyzer] Version not found:", versionError);
      return NextResponse.json({ error: "Version non trovata" }, { status: 404 });
    }

    // 2) Recupero progetto per profileKey/mode
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, genre, mix_type")
      .eq("id", version.project_id)
      .maybeSingle();

    if (projectError || !project) {
      console.error("[run-analyzer] Project not found:", projectError);
      return NextResponse.json({ error: "Project non trovato" }, { status: 404 });
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

const rawAudioUrl = typeof version.audio_url === "string" ? version.audio_url.trim() : "";
const rawAudioPath = typeof version.audio_path === "string" ? version.audio_path.trim() : "";

const directUrl = rawAudioUrl && rawAudioUrl.startsWith("http") ? rawAudioUrl : null;

// Supporto legacy: se audio_url non è http, lo tratto come path
const audioPath = rawAudioPath || (rawAudioUrl && !rawAudioUrl.startsWith("http") ? rawAudioUrl : null);

if (!directUrl && !audioPath) {
  return NextResponse.json(
    { error: "Nessun audio_path o audio_url valido per questa versione" },
    { status: 400 }
  );
}


let audioUrl = directUrl;
if (!audioUrl && audioPath) {
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
      upload_arrays_blob: true,
      storage_bucket: "tracks",
      storage_base_path: "analyzer",
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

    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("[run-analyzer] response not json");
      return NextResponse.json({ error: "Analyzer returned non-JSON" }, { status: 502 });
    }

    const warnings = [
      ...(Array.isArray(data?.warnings) ? data.warnings : []),
      ...(Array.isArray(data?.loudness_stats?.warnings) ? data.loudness_stats.warnings : []),
    ].slice(0, 10);
    console.log("[run-analyzer] warnings ->", warnings);

    const matchRatio =
      typeof data?.model_match?.match_ratio === "number" && Number.isFinite(data.model_match.match_ratio)
        ? data.model_match.match_ratio
        : null;
    const modelMatchPercent = matchRatio == null ? null : Math.round(matchRatio * 100);
    const bandEnergyNorm = (data as any)?.band_energy_norm;
    const hasBandNorm =
      !!bandEnergyNorm && typeof bandEnergyNorm === "object" && Object.keys(bandEnergyNorm).length > 0;

    console.log(
      "[run-analyzer] brief ->",
      JSON.stringify(
        {
          bpm: data?.bpm,
          key: data?.key,
          lufs: data?.loudness_stats?.integrated_lufs,
          lra: data?.loudness_stats?.lra,
          sample_peak_db: data?.loudness_stats?.sample_peak_db,
          spectral_keys: Object.keys(data?.spectral ?? {}),
          has_band_norm: hasBandNorm,
          model_match_percent: modelMatchPercent,
          model_match: data?.model_match ?? null,
          arrays_blob_path: data?.arrays_blob_path ?? null,
          arrays_blob_size_bytes: data?.arrays_blob_size_bytes ?? null,
        },
        null,
        2
      )
    );

    if (!analyzerRes.ok) {
      console.error("[run-analyzer] Analyzer error:", analyzerRes.status);
      return NextResponse.json(
        { error: "Errore dall'Analyzer", detail: raw || null },
        { status: 502 }
      );
    }

    const result = data as AnalyzerResult;

    // 4) Mapping centralizzato
    const updatePayload = buildAnalyzerUpdatePayload(result);

    // fallback se analyzer_key non esiste nel DB
    const payloadWithoutKey = (() => {
      const { analyzer_key: _analyzer_key, ...rest } = updatePayload as any;
      return rest as Omit<typeof updatePayload, "analyzer_key">;
    })();

    const payloadWithoutArrays = (() => {
      const {
        arrays_blob_path: _arrays_blob_path,
        arrays_blob_size_bytes: _arrays_blob_size_bytes,
        ...rest
      } = updatePayload as any;
      return rest as typeof updatePayload;
    })();

    const payloadWithoutKeyAndArrays = (() => {
      const { analyzer_key: _analyzer_key, ...rest } = payloadWithoutArrays as any;
      return rest as typeof updatePayload;
    })();

    const hasAnalyzerKeyError = (error: any) => {
      if (!error) return false;
      const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
      return message.includes("analyzer_key");
    };

    const selectFieldsBase = [
      "id",
      "version_name",
      "created_at",
      "audio_url",
      "lufs",
      "overall_score",
      "feedback",
      "model_match_percent",
      "analyzer_bpm",
      "analyzer_key",
      "analyzer_spectral_centroid_hz",
      "analyzer_spectral_rolloff_hz",
      "analyzer_spectral_bandwidth_hz",
      "analyzer_spectral_flatness",
      "analyzer_zero_crossing_rate",
      "analyzer_reference_ai",
      "fix_suggestions",
      "analyzer_json",
      // Se NON hai questa colonna, rimuovila da qui
      "analysis_pro",
      "waveform_peaks",
      "waveform_duration",
      "waveform_bands",
    ];

    const getPayload = (includeKey: boolean, includeArrays: boolean) => {
      if (includeKey && includeArrays) {
        return updatePayload;
      }
      if (!includeKey && includeArrays) {
        return payloadWithoutKey;
      }
      if (includeKey && !includeArrays) {
        return payloadWithoutArrays;
      }
      return payloadWithoutKeyAndArrays;
    };

    const updateVersion = async (includeKey: boolean, includeArrays: boolean) =>
      supabase
        .from("project_versions")
        .update(getPayload(includeKey, includeArrays))
        .eq("id", version.id)
        .select(selectFieldsBase.join(", "))
        .maybeSingle();

    let includeKey = true;
    let includeArrays = true;
    let updateResult = await updateVersion(includeKey, includeArrays);

    while (updateResult.error) {
      const message = `${updateResult.error.message ?? ""} ${updateResult.error.details ?? ""}`.toLowerCase();
      let retried = false;

      if (
        includeArrays &&
        (message.includes("arrays_blob_path") || message.includes("arrays_blob_size_bytes"))
      ) {
        console.warn("[run-analyzer] arrays_blob columns missing, retry without arrays fields");
        includeArrays = false;
        retried = true;
      }

      if (includeKey && hasAnalyzerKeyError(updateResult.error)) {
        console.warn("[run-analyzer] analyzer_key missing, retry senza analyzer_key");
        includeKey = false;
        retried = true;
      }

      if (!retried) {
        break;
      }

      updateResult = await updateVersion(includeKey, includeArrays);
    }

    const { data: updatedVersion, error: updateError } = updateResult;

    if (updateError || !updatedVersion) {
      console.error("[run-analyzer] Update version error:", updateError);
      return NextResponse.json(
        { error: "Errore aggiornando i dati di analisi" },
        { status: 500 }
      );
    }

    console.log("[run-analyzer] saved lufs ->", (updatedVersion as any)?.lufs);

    return NextResponse.json(
      { ok: true, version: updatedVersion, analyzer_result: result },
      { status: 200 }
    );
  } catch (err) {
    console.error("Unexpected run-analyzer error:", err);
    return NextResponse.json({ error: "Errore inatteso Analyzer" }, { status: 500 });
  }
}
