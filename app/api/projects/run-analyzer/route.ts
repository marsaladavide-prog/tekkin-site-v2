
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
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
  .select("id, project_id, audio_url, audio_path, version_name, mix_type")
  .eq("id", versionId)
  .maybeSingle();

    if (versionError || !version) {
      console.error("[run-analyzer] Version not found:", versionError);
      return NextResponse.json({ error: "Version non trovata" }, { status: 404 });
    }

    if (version.mix_type !== "master" && version.mix_type !== "premaster") {
      return NextResponse.json({ error: "mix_type non valido" }, { status: 400 });
    }

    // 2) Recupero progetto per profileKey/mode
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, genre")
      .eq("id", version.project_id)
      .maybeSingle();

    if (projectError || !project) {
      console.error("[run-analyzer] Project not found:", projectError);
      return NextResponse.json({ error: "Project non trovato" }, { status: 404 });
    }

    const profileKey = project.genre || "minimal_deep_tech";
    const mode = version.mix_type === "master" ? "master" : "premaster";

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

    const res = await fetch(process.env.TEKKIN_ANALYZER_URL!, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-analyzer-secret": process.env.TEKKIN_ANALYZER_SECRET ?? "",
      },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    console.log("[run-analyzer] status ->", res.status);
    console.log("[run-analyzer] raw size ->", raw.length);
    console.log("[run-analyzer] raw head ->", raw.slice(0, 600));

    // DEV: dump completo risposta analyzer su file (così hai sempre l'output raw intero)
    try {
      if (process.env.NODE_ENV !== "production") {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");

        const outDir = path.join(process.cwd(), ".tekkin-debug");
        await fs.mkdir(outDir, { recursive: true });

        const outPath = path.join(outDir, `analyze_${payload.version_id || 'unknown'}.json`);
        await fs.writeFile(outPath, raw, "utf-8");

        console.log("[run-analyzer] raw saved ->", outPath);
      }
    } catch (e) {
      console.log("[run-analyzer] raw save failed ->", e);
    }

    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("[run-analyzer] response not json");
      return NextResponse.json({ error: "Analyzer returned non-JSON" }, { status: 502 });
    }


    // Deep logging of key analyzer fields and arrays blob contents (arrays_blob is the source)
    console.log("[run-analyzer] DEEP LOG: raw arrays.spectrum_db ->", data?.arrays_blob?.spectrum_db ?? null);
    console.log("[run-analyzer] DEEP LOG: raw arrays.sound_field ->", data?.arrays_blob?.sound_field ?? null);
    console.log("[run-analyzer] DEEP LOG: raw arrays.levels ->", data?.arrays_blob?.levels ?? null);
    console.log("[run-analyzer] DEEP LOG: raw arrays.transients ->", data?.arrays_blob?.transients ?? null);

    // More compact/usable logs: lengths where applicable
    try {
      console.log(
        "[run-analyzer] DEEP LOG: arrays.spectrum_db len ->",
        Array.isArray(data?.arrays_blob?.spectrum_db?.hz) ? data.arrays_blob.spectrum_db.hz.length : null
      );
    } catch (e) {
      /* ignore */
    }
    try {
      console.log(
        "[run-analyzer] DEEP LOG: arrays.levels channels ->",
        Array.isArray(data?.arrays_blob?.levels?.channels) ? data.arrays_blob.levels.channels.length : null
      );
    } catch (e) {
      /* ignore */
    }
    console.log("[run-analyzer] DEEP LOG: arrays_blob_path ->", data?.arrays_blob_path ?? null);
    console.log("[run-analyzer] DEEP LOG: arrays_blob_size_bytes ->", data?.arrays_blob_size_bytes ?? null);
    // Optionally log the full arrays blob if available and not too large
    if (data?.arrays_blob && typeof data.arrays_blob === "object") {
      try {
        console.log("[run-analyzer] DEEP LOG: arrays_blob (truncated) ->", JSON.stringify(data.arrays_blob, null, 2).slice(0, 2000));
      } catch (e) {
        console.log("[run-analyzer] arrays_blob stringify failed", e);
      }
    }
    // Existing brief log
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

    if (!res.ok) {
      console.error("[run-analyzer] Analyzer error:", res.status);
      return NextResponse.json(
        { error: "Errore dall'Analyzer", detail: raw || null },
        { status: 502 }
      );
    }

    const result = data as AnalyzerResult;


    // 4) Mapping centralizzato
    const updatePayload = buildAnalyzerUpdatePayload(result);

    // PATCH arrays.json: aggiungo spectrum_db / sound_field / levels (proxy intelligenti)
    let patchedArraysBytes: number | null = null;

    try {
      const arraysPath =
        (result as any)?.arrays_blob_path ??
        (updatePayload as any)?.arrays_blob_path ??
        null;

      if (typeof arraysPath === "string" && arraysPath.length > 0) {
        const arraysPatched = buildArraysBlobPatched(data);

        console.log("[run-analyzer] DEEP LOG: patched arrays keys ->", Object.keys(arraysPatched ?? {}));
        console.log("[run-analyzer] DEEP LOG: patched transients ->", arraysPatched?.transients ?? null);
        console.log(
          "[run-analyzer] DEEP LOG: patched has transients obj ->",
          !!arraysPatched?.transients && typeof arraysPatched.transients === "object"
        );

        const up = await uploadJsonWithServiceRole("tracks", arraysPath, arraysPatched);

        if (up.error) {
          console.log("[run-analyzer] PATCH arrays upload FAILED ->", {
            path: arraysPath,
            err: up.error.message ?? String(up.error),
          });
        } else {
          patchedArraysBytes = up.bytes;

          console.log("[run-analyzer] PATCH arrays upload OK ->", {
            path: arraysPath,
            bytes: up.bytes,
            keys: Object.keys(arraysPatched),
            has_spectrum_db: !!arraysPatched.spectrum_db,
            has_sound_field: !!arraysPatched.sound_field,
            has_levels: !!arraysPatched.levels,
          });

          // aggiorno il payload DB così size resta coerente
          (updatePayload as any).arrays_blob_size_bytes = patchedArraysBytes;
        }
      } else {
        console.log("[run-analyzer] PATCH arrays skipped -> arrays_blob_path missing");
      }
    } catch (e: any) {
      console.log("[run-analyzer] PATCH arrays exception ->", e?.message ?? e);
    }

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

    // After the update on project_versions
const { data: checkRow } = await supabase
  .from("project_versions")
  .select("id, arrays_blob_path")
  .eq("id", versionId)
  .maybeSingle();

console.log("[run-analyzer] db arrays_blob_path after update ->", checkRow?.arrays_blob_path);

    return NextResponse.json(
      { ok: true, version: updatedVersion, analyzer_result: result },
      { status: 200 }
    );

  } catch (err) {
    console.error("Unexpected run-analyzer error:", err);
    return NextResponse.json({ error: "Errore inatteso Analyzer" }, { status: 500 });
  }
}


// --- HELPERS ---

let _admin: ReturnType<typeof createSupabaseAdmin> | null = null;

function getAdmin() {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  _admin = createSupabaseAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _admin;
}

async function uploadJsonWithServiceRole(bucket: string, path: string, json: any) {
  const admin = getAdmin();
  const body = JSON.stringify(json);

  const { error } = await admin.storage
    .from(bucket)
    .upload(path, body, {
      contentType: "application/json",
      upsert: true,
    });

  return { error, bytes: Buffer.byteLength(body, "utf8") };
}

function safeNum(v: any): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function buildArraysBlobPatched(result: any) {
  const base =
    result?.arrays_blob && typeof result.arrays_blob === "object" ? (result.arrays_blob as any) : {};

  // loudness: preferisci quello dentro arrays_blob (contiene momentary/short term arrays)
  const loudness_stats =
    base?.loudness_stats && typeof base.loudness_stats === "object"
      ? base.loudness_stats
      : result?.loudness_stats && typeof result.loudness_stats === "object"
        ? result.loudness_stats
        : {};

  const analysis_pro =
    base?.analysis_pro && typeof base.analysis_pro === "object"
      ? base.analysis_pro
      : result?.analysis_pro && typeof result.analysis_pro === "object"
        ? result.analysis_pro
        : {};

  // PRESERVA transients se già calcolati dal Python; ma assicurati che non sia mai null
  const transientsRaw =
    (base?.transients && typeof base.transients === "object" ? base.transients : null) ??
    (result?.transients && typeof result.transients === "object" ? result.transients : null) ??
    null;

  const transients =
    transientsRaw && typeof transientsRaw === "object"
      ? transientsRaw
      : { strength: 0, density: 0, crest_factor_db: 0 };

  // Se non esiste, placeholder NON-null per test UI
  const spectrum_db =
    base?.spectrum_db && typeof base.spectrum_db === "object"
      ? base.spectrum_db
      : result?.spectrum_db && typeof result.spectrum_db === "object"
        ? result.spectrum_db
        : {
            hz: [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000],
            track_db: [-45, -35, -28, -24, -26, -29, -33, -38, -44, -52],
          };

  const sound_field =
    base?.sound_field && typeof base.sound_field === "object"
      ? base.sound_field
      : result?.sound_field && typeof result.sound_field === "object"
        ? result.sound_field
        : {
            angle_deg: [0, 60, 120, 180, 240, 300, 360],
            radius: [0.35, 0.55, 0.42, 0.35, 0.48, 0.52, 0.35],
          };

  const levels =
    base?.levels && typeof base.levels === "object"
      ? base.levels
      : result?.levels && typeof result.levels === "object"
        ? result.levels
        : {
            channels: ["L", "R"],
            rms_db: [
              safeNum(loudness_stats?.integrated_lufs) ?? -24,
              safeNum(loudness_stats?.integrated_lufs) ?? -24,
            ],
            peak_db: [
              safeNum(loudness_stats?.sample_peak_db) ?? -12,
              safeNum(loudness_stats?.sample_peak_db) ?? -12,
            ],
          };

  // IMPORTANTISSIMO: mergea preservando qualunque altro campo già presente in arrays_blob
  return {
    ...base,
    loudness_stats,
    analysis_pro,
    transients,
    spectrum_db,
    sound_field,
    levels,
  };
}

