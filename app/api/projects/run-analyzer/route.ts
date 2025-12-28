import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { buildAnalyzerUpdatePayload } from "@/lib/analyzer/handleAnalyzerResult";
import { mapVersionToAnalyzerCompareModel } from "@/lib/analyzer/v2/mapVersionToAnalyzerCompareModel";
import { calculateTekkinVersionRankFromModel } from "@/lib/analyzer/tekkinVersionRank";
import { loadReferenceModel } from "@/lib/reference/loadReferenceModel";


function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export const runtime = "nodejs";

const DEBUG_ANALYZER_DEEP = process.env.TEKKIN_ANALYZER_DEEP_LOG === "1";
const DEBUG_WAVEFORM_PIPELINE = process.env.TEKKIN_WAVEFORM_DEBUG === "1";

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

    const body = (await req.json()) as unknown;
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const versionId =
      typeof body.version_id === "string" && body.version_id.trim()
        ? body.version_id.trim()
        : null;

    const analyzerVersion =
      typeof body.analyzer_version === "string" && body.analyzer_version.trim()
        ? body.analyzer_version.trim()
        : "v3";

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
      .select("id, genre, title")
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

      // NEW
      analyzer_version: analyzerVersion,
    };

    console.log("[run-analyzer] payload ->", {
      version_id: payload.version_id,
      project_id: payload.project_id,
      profile_key: payload.profile_key,
      mode: payload.mode,
      analyzer_version: payload.analyzer_version ?? null,
      upload_arrays_blob: payload.upload_arrays_blob ?? null,
      storage_bucket: payload.storage_bucket ?? null,
      storage_base_path: payload.storage_base_path ?? null,
      // non loggare audio_url: è lunga e sporca
    });

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
    console.log("[run-analyzer] analyzer http ->", { status: res.status, bytes: raw.length });

    if (DEBUG_ANALYZER_DEEP) {
      console.log("[run-analyzer] raw head ->", raw.slice(0, 600));
    }

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
    } catch (_e) {
      console.log("[run-analyzer] raw save failed ->", _e);
    }

    let data: unknown = null;
    try {
      data = JSON.parse(raw);
    } catch (_e) {
      console.error("[run-analyzer] response not json");
      return NextResponse.json({ error: "Analyzer returned non-JSON" }, { status: 502 });
    }

if (!isRecord(data)) {
  console.error("[run-analyzer] analyzer returned non-object JSON");
  return NextResponse.json({ error: "Analyzer returned invalid JSON" }, { status: 502 });
}

// check minimo: deve avere almeno version_id oppure meta/version ecc
const hasSomeId =
  typeof (data as any).version_id === "string" ||
  typeof (data as any).versionId === "string" ||
  typeof (data as any).version === "string";

if (!hasSomeId) {
  console.error("[run-analyzer] analyzer json missing expected keys");
  return NextResponse.json({ error: "Analyzer returned invalid JSON" }, { status: 502 });
}

const result = data as unknown as any;
const updatePayload = buildAnalyzerUpdatePayload(result);

    if (DEBUG_ANALYZER_DEEP) {
  logAnalyzerSummary("run-analyzer", result);
}


    console.log("[run-analyzer] update payload keys ->", Object.keys(updatePayload));
console.log("[run-analyzer] update payload preview ->", {
  lufs: updatePayload.lufs,
  analyzer_bpm: (updatePayload as any).analyzer_bpm ?? null,
  analyzer_key: (updatePayload as any).analyzer_key ?? null,
  arrays_blob_path: (updatePayload as any).arrays_blob_path ?? null,
});
const arraysPath =
  (result as any)?.arrays_blob_path ??
  (updatePayload as any)?.arrays_blob_path ??
  null;

let arraysJson: Record<string, unknown> | null = null;

if (typeof arraysPath === "string" && arraysPath.length > 0) {
  const dl = await downloadJsonWithServiceRole("tracks", arraysPath);
  if (!dl.error && dl.json && isRecord(dl.json)) {
    const existing = dl.json as Record<string, unknown>;
    const patch = buildArraysBlobPatched(result);
    arraysJson = { ...existing, ...patch };
  }
}

    try {
      const referenceModel = await loadReferenceModel(profileKey);
      const versionForModel = {
        ...updatePayload,
        id: version.id,
        project_id: version.project_id,
        project: { id: project.id, title: project.title ?? "Untitled project" },
        version_name: version.version_name,
        mix_type: version.mix_type,
        analyzer_arrays: arraysJson,
        analyzer_profile_key: profileKey,
        reference_model_key: profileKey,
      };

      const model = mapVersionToAnalyzerCompareModel(versionForModel, referenceModel);
      const tekkinVersionRank = calculateTekkinVersionRankFromModel(model);
      updatePayload.overall_score = tekkinVersionRank.score;
      console.log("[run-analyzer] tekkin rank ->", tekkinVersionRank.score);
    } catch (rankErr) {
      console.warn("[run-analyzer] tekkin rank calcolo fallito", rankErr);
    }

    if (DEBUG_WAVEFORM_PIPELINE) {
      const bands = (updatePayload as any)?.waveform_bands;
      console.log("[run-analyzer] update payload waveform ->", {
        peaksLen: Array.isArray((updatePayload as any)?.waveform_peaks)
          ? (updatePayload as any).waveform_peaks.length
          : null,
        duration: typeof (updatePayload as any).waveform_duration === "number"
          ? (updatePayload as any).waveform_duration
          : null,
        bandsKeys: bands && typeof bands === "object" ? Object.keys(bands) : null,
      });
    }


    // PATCH arrays: genero arrays_view.json (leggero) senza toccare arrays.json
    try {
      if (typeof arraysPath === "string" && arraysPath.length > 0) {
        const existing = arraysJson;

        if (!existing || typeof existing !== "object") {
          console.log("[run-analyzer] arrays_view skipped -> arrays.json missing/unreadable", {
            path: arraysPath,
          });
        } else {
          console.log("[run-analyzer] arrays blob has fields", Object.keys(existing));
          if ("sound_field" in existing) {
            console.log(
              "[run-analyzer] arrays blob sound_field sample",
              (existing as any).sound_field?.slice?.(0, 5) ?? null
            );
          }
          if ("sound_field_ref" in existing) {
            console.log(
              "[run-analyzer] arrays blob sound_field_ref sample",
              (existing as any).sound_field_ref?.angle_deg?.slice?.(0, 5) ?? null
            );
          }

          const view = buildArraysView(existing);

          const viewPath = arraysPath.endsWith("/arrays.json")
            ? arraysPath.replace(/\/arrays\.json$/, "/arrays_view.json")
            : `${arraysPath.replace(/\/+$/, "")}_view.json`;

          const up = await uploadJsonWithServiceRole("tracks", viewPath, view);

          if (up.error) {
            console.log("[run-analyzer] arrays_view upload FAILED ->", {
              path: viewPath,
              err: up.error.message ?? String(up.error),
            });
          } else {
            console.log("[run-analyzer] arrays_view upload OK ->", {
              path: viewPath,
              bytes: up.bytes,
            });
          }
        }
      } else {
        console.log("[run-analyzer] arrays_view skipped -> arrays_blob_path missing");
      }
    } catch (_e: unknown) {
      console.log("[run-analyzer] arrays_view exception ->", _e);
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

    const hasAnalyzerKeyError = (error: unknown) => {
      if (!error) return false;
      const message = `${(error as any)?.message ?? ""} ${(error as any)?.details ?? ""}`.toLowerCase();
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
      const message = `${updateResult.error?.message ?? ""} ${updateResult.error?.details ?? ""}`.toLowerCase();
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

    if (DEBUG_WAVEFORM_PIPELINE) {
      const saved = updatedVersion as any;
      const bands = saved?.waveform_bands;
      console.log("[run-analyzer] update result waveform ->", {
        peaksLen: Array.isArray(saved?.waveform_peaks) ? saved.waveform_peaks.length : null,
        duration: typeof saved?.waveform_duration === "number" ? saved.waveform_duration : null,
        bandsKeys: bands && typeof bands === "object" ? Object.keys(bands) : null,
      });
    }

    console.log("[run-analyzer] saved lufs ->", (updatedVersion as any)?.lufs);

    // After the update on project_versions
const { data: checkRow } = await supabase
  .from("project_versions")
  .select("id, arrays_blob_path, waveform_peaks, waveform_duration, waveform_bands")
  .eq("id", versionId)
  .maybeSingle();

console.log("[run-analyzer] db arrays_blob_path after update ->", checkRow?.arrays_blob_path);

if (DEBUG_WAVEFORM_PIPELINE) {
  const bands = checkRow?.waveform_bands;
  const persistedPeaks = checkRow?.waveform_peaks;
  console.log("[run-analyzer] db waveform after update ->", {
    peaksLen: Array.isArray(persistedPeaks) ? persistedPeaks.length : null,
    duration: typeof checkRow?.waveform_duration === "number" ? checkRow.waveform_duration : null,
    bandsKeys: bands && typeof bands === "object" ? Object.keys(bands) : null,
  });
}

    return NextResponse.json(
      { ok: true, version: updatedVersion, analyzer_result: result },
      { status: 200 }
    );

  } catch (err: unknown) {
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

async function downloadJsonWithServiceRole(bucket: string, path: string) {
  const admin = getAdmin();
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) return { error, json: null as unknown };

  const text = await data.text();
  try {
    return { error: null, json: JSON.parse(text) as unknown };
  } catch (_e: unknown) {
    return { error: new Error("Invalid JSON in arrays blob"), json: null as unknown };
  }
}

function _downsample(xs: number[], maxPoints: number) {
  if (!Array.isArray(xs)) return [];
  const n = xs.length;
  if (n <= maxPoints) return xs;
  const step = Math.ceil(n / maxPoints);
  const out: number[] = [];
  for (let i = 0; i < n; i += step) out.push(xs[i]);
  return out;
}

function buildArraysBlobPatched(result: any) {
  const base =
    result?.arrays_blob && typeof result.arrays_blob === "object" ? (result.arrays_blob as any) : {};

  const pickObj = (x: any) => (x && typeof x === "object" ? x : null);

  const loudness_stats =
    pickObj(base?.loudness_stats) ??
    pickObj(result?.loudness_stats) ??
    pickObj(result?.blocks?.loudness?.data) ??
    null;

  const transients =
    pickObj(base?.transients) ??
    pickObj(result?.transients) ??
    pickObj(result?.blocks?.transients?.data) ??
    null;

  // Normalize transients keys (v3 summary compat)
  const transientsNormalized =
    transients && typeof transients === "object"
      ? {
          ...transients,

          // strength
          strength:
            typeof (transients as any).strength === "number"
              ? (transients as any).strength
              : typeof (transients as any).transient_strength === "number"
                ? (transients as any).transient_strength
                : typeof (transients as any).transientStrength === "number"
                  ? (transients as any).transientStrength
                  : null,

          // density
          density:
            typeof (transients as any).density === "number"
              ? (transients as any).density
              : typeof (transients as any).transient_density === "number"
                ? (transients as any).transient_density
                : typeof (transients as any).transientDensity === "number"
                  ? (transients as any).transientDensity
                  : null,

          // crest factor
          crest_factor_db:
            typeof (transients as any).crest_factor_db === "number"
              ? (transients as any).crest_factor_db
              : typeof (transients as any).crestFactorDb === "number"
                ? (transients as any).crestFactorDb
                : null,

          // log attack time
          log_attack_time:
            typeof (transients as any).log_attack_time === "number"
              ? (transients as any).log_attack_time
              : typeof (transients as any).logAttackTime === "number"
                ? (transients as any).logAttackTime
                : null,
        }
      : null;

  const spectrum_db =
    pickObj(base?.spectrum_db) ??
    pickObj(result?.arrays_blob?.spectrum_db) ??
    pickObj(result?.blocks?.timbre_spectrum?.data?.spectrum_db) ??
    null;

  const sound_field =
    pickObj(base?.sound_field) ??
    pickObj(result?.arrays_blob?.sound_field) ??
    pickObj(result?.blocks?.stereo?.data?.sound_field) ??
    null;

  const levels =
    pickObj(base?.levels) ??
    pickObj(result?.levels) ??
    pickObj(result?.blocks?.levels?.data) ??
    null;

  const analysis_pro =
    pickObj(base?.analysis_pro) ??
    pickObj(result?.analysis_pro) ??
    null;

  // NEW: bands_norm / band_energy_norm
  const band_energy_norm =
    pickObj(base?.band_energy_norm) ??
    pickObj(result?.band_energy_norm) ??
    pickObj(result?.bands_norm) ??
    pickObj(result?.blocks?.timbre_spectrum?.data?.bands_norm) ??
    pickObj(result?.blocks?.bands_norm?.data) ??
    null;

  // NEW: spectral
  const spectral =
    pickObj(base?.spectral) ??
    pickObj(result?.spectral) ??
    pickObj(result?.blocks?.spectral?.data) ??
    null;

  // NEW: loudness percentiles
  const momentary_percentiles =
    pickObj(base?.momentary_percentiles) ??
    pickObj(result?.momentary_percentiles) ??
    pickObj(result?.blocks?.loudness?.data?.momentary_percentiles) ??
    null;

  const short_term_percentiles =
    pickObj(base?.short_term_percentiles) ??
    pickObj(result?.short_term_percentiles) ??
    pickObj(result?.blocks?.loudness?.data?.short_term_percentiles) ??
    null;

  // NEW: sections
  const sections =
    pickObj(base?.sections) ??
    pickObj(result?.sections) ??
    pickObj(result?.blocks?.loudness?.data?.sections) ??
    pickObj(result?.blocks?.sections?.data) ?? // legacy, se esiste
    null;

  // NEW: stereo small + correlation array
  const width_by_band =
    pickObj(base?.width_by_band) ??
    pickObj(result?.width_by_band) ??
    pickObj(result?.blocks?.stereo?.data?.width_by_band) ??
    null;

  const stereo_summary =
    pickObj(base?.stereo_summary) ??
    pickObj(result?.stereo_summary) ??
    pickObj(result?.blocks?.stereo?.data?.stereo_summary) ??
    pickObj(result?.blocks?.stereo?.data?.summary) ??
    null;


  const correlation =
    Array.isArray(base?.correlation) ? base.correlation :
    Array.isArray(result?.correlation) ? result.correlation :
    Array.isArray(result?.blocks?.stereo?.data?.correlation) ? result.blocks.stereo.data.correlation :
    Array.isArray((result as any)?.blocks?.stereo?.data?.correlation_view) ? (result as any).blocks.stereo.data.correlation_view :
    null;


  const stereo_width =
    typeof base?.stereo_width === "number" ? base.stereo_width :
    typeof result?.stereo_width === "number" ? result.stereo_width :
    typeof result?.blocks?.stereo?.data?.stereo_width === "number" ? result.blocks.stereo.data.stereo_width :
    null;

  // NEW: rhythm extra arrays
  const beat_times =
    Array.isArray(base?.beat_times) ? base.beat_times :
    Array.isArray(result?.beat_times) ? result.beat_times :
    Array.isArray(result?.blocks?.rhythm?.data?.beat_times_view) ? result.blocks.rhythm.data.beat_times_view :
    Array.isArray(result?.blocks?.rhythm?.data?.beat_times) ? result.blocks.rhythm.data.beat_times :
    null;

  const rhythm_descriptors =
    pickObj(base?.rhythm_descriptors) ??
    pickObj(result?.rhythm_descriptors) ??
    pickObj(result?.blocks?.rhythm?.data?.descriptors) ??
    null;

  const relative_key =
    typeof base?.relative_key === "string" ? base.relative_key :
    typeof result?.relative_key === "string" ? result.relative_key :
    typeof result?.blocks?.rhythm?.data?.relative_key === "string" ? result.blocks.rhythm.data.relative_key :
    typeof result?.blocks?.rhythm?.data?.descriptors?.relative_key === "string" ? result.blocks.rhythm.data.descriptors.relative_key :
    null;

  const danceability =
    typeof base?.danceability === "number" ? base.danceability :
    typeof result?.danceability === "number" ? result.danceability :
    typeof result?.blocks?.rhythm?.data?.danceability === "number" ? result.blocks.rhythm.data.danceability :
    null;

  // NEW: extra (support V3 shape + legacy flat)
  const extraData =
    pickObj(base?.extra) ??
    pickObj(result?.extra) ??
    pickObj(result?.blocks?.extra?.data) ??
    null;

  const mfcc_mean =
    Array.isArray((extraData as any)?.mfcc_mean)
      ? (extraData as any).mfcc_mean
      : Array.isArray((extraData as any)?.mfcc?.mean)
        ? (extraData as any).mfcc.mean
        : null;

  const hfc =
    typeof (extraData as any)?.hfc === "number" ? (extraData as any).hfc : null;

  const spectralPeaksRaw = (extraData as any)?.spectral_peaks;

  const spectral_peaks_count =
    typeof (extraData as any)?.spectral_peaks_count === "number"
      ? (extraData as any).spectral_peaks_count
      : Array.isArray(spectralPeaksRaw)
        ? spectralPeaksRaw.length
        : typeof spectralPeaksRaw?.count === "number"
          ? spectralPeaksRaw.count
          : null;

  const spectral_peaks_energy =
    typeof (extraData as any)?.spectral_peaks_energy === "number"
      ? (extraData as any).spectral_peaks_energy
      : typeof (extraData as any)?.spectral_peaks?.energy === "number"
        ? (extraData as any).spectral_peaks.energy
        : null;

  return {
    ...base,
    ...(loudness_stats ? { loudness_stats } : {}),
    ...(transientsNormalized ? { transients: transientsNormalized } : {}),
    ...(spectrum_db ? { spectrum_db } : {}),
    ...(sound_field ? { sound_field } : {}),
    ...(levels ? { levels } : {}),
    ...(analysis_pro ? { analysis_pro } : {}),
    ...(band_energy_norm ? { band_energy_norm } : {}),
    ...(spectral ? { spectral } : {}),
    ...(momentary_percentiles ? { momentary_percentiles } : {}),
    ...(short_term_percentiles ? { short_term_percentiles } : {}),
    ...(sections ? { sections } : {}),
    ...(width_by_band ? { width_by_band } : {}),
    ...(stereo_summary ? { stereo_summary } : {}),
    ...(correlation ? { correlation } : {}),
    ...(stereo_width != null ? { stereo_width } : {}),
    ...(beat_times ? { beat_times } : {}),
    ...(rhythm_descriptors ? { rhythm_descriptors } : {}),
    ...(relative_key ? { relative_key } : {}),
    ...(danceability != null ? { danceability } : {}),
    ...(mfcc_mean ? { mfcc_mean } : {}),
    ...(hfc != null ? { hfc } : {}),
    ...(spectral_peaks_count != null ? { spectral_peaks_count } : {}),
    ...(spectral_peaks_energy != null ? { spectral_peaks_energy } : {}),
  };
}

function buildArraysView(merged: Record<string, any>) {
  const loud = merged?.loudness_stats && typeof merged.loudness_stats === "object" ? merged.loudness_stats : null;

  const momentary =
    Array.isArray(loud?.momentary_lufs) ? loud.momentary_lufs
    : Array.isArray(loud?.momentary_lufs_raw) ? loud.momentary_lufs_raw
    : Array.isArray(loud?.momentary_lufs_view) ? loud.momentary_lufs_view
    : [];

  const shortTerm =
    Array.isArray(loud?.short_term_lufs) ? loud.short_term_lufs
    : Array.isArray(loud?.short_term_lufs_raw) ? loud.short_term_lufs_raw
    : Array.isArray(loud?.short_term_lufs_view) ? loud.short_term_lufs_view
    : [];

  const correlationArr = Array.isArray(merged?.correlation) ? merged.correlation : [];
  const beatTimesArr = Array.isArray(merged?.beat_times) ? merged.beat_times : [];

  const loudBase = loud
    ? {
        integrated_lufs: loud.integrated_lufs ?? null,
        lra: loud.lra ?? null,
        sample_peak_db: loud.sample_peak_db ?? null,
        true_peak_db: loud.true_peak_db ?? null,
        true_peak_method: loud.true_peak_method ?? null,
        momentary_percentiles: merged?.momentary_percentiles ?? null,
        short_term_percentiles: merged?.short_term_percentiles ?? null,
        momentary_lufs: _downsample(momentary, 400),
        short_term_lufs: _downsample(shortTerm, 400),
      }
    : null;

  const view = {
    loudness_stats: loudBase,

    spectrum_db: merged?.spectrum_db ?? null,
    sound_field: merged?.sound_field ?? null,
    levels: merged?.levels ?? null,

    transients: merged?.transients ?? null,
    analysis_pro: merged?.analysis_pro ?? null,

    // NEW: quello che avevi nel --summary
    band_energy_norm: merged?.band_energy_norm ?? null,
    spectral: merged?.spectral ?? null,

    momentary_percentiles: merged?.momentary_percentiles ?? null,
    short_term_percentiles: merged?.short_term_percentiles ?? null,
    sections: merged?.sections ?? null,

    stereo_width: typeof merged?.stereo_width === "number" ? merged.stereo_width : null,
    width_by_band: merged?.width_by_band ?? null,
    stereo_summary: merged?.stereo_summary ?? null,
    correlation: correlationArr.length ? _downsample(correlationArr, 512) : null,

    relative_key: typeof merged?.relative_key === "string" ? merged.relative_key : null,
    danceability: typeof merged?.danceability === "number" ? merged.danceability : null,
    rhythm_descriptors: merged?.rhythm_descriptors ?? null,
    beat_times: beatTimesArr.length ? _downsample(beatTimesArr, 256) : null,

    mfcc_mean: Array.isArray(merged?.mfcc_mean) ? _downsample(merged.mfcc_mean, 13) : null,
    hfc: typeof merged?.hfc === "number" ? merged.hfc : null,
    spectral_peaks_count: typeof merged?.spectral_peaks_count === "number" ? merged.spectral_peaks_count : null,
    spectral_peaks_energy: typeof merged?.spectral_peaks_energy === "number" ? merged.spectral_peaks_energy : null,
  };

  return view;
}

function logAnalyzerSummary(tag: string, raw: any) {
  try {
    const version = typeof raw?.version === "string" ? raw.version : null;

    const profileKey =
      typeof raw?.profile_key === "string"
        ? raw.profile_key
        : typeof raw?.profileKey === "string"
          ? raw.profileKey
          : null;

    const loud = raw?.blocks?.loudness?.data ?? null;
    const spec = raw?.blocks?.spectral?.data ?? null;

    // V3: SOURCE REALE bands_norm
    const timbre = raw?.blocks?.timbre_spectrum?.data ?? null;
    const timbreBands = timbre?.bands_norm ?? null;

    // Vecchi fallback se un domani li rimetti
    const bandsLegacy = raw?.blocks?.bands_norm?.data ?? null;

    const stereo = raw?.blocks?.stereo?.data ?? null;
    const trans = raw?.blocks?.transients?.data ?? null;
    const rhy = raw?.blocks?.rhythm?.data ?? null;
    const extra = raw?.blocks?.extra?.data ?? null;

    const sectionsData =
      raw?.blocks?.loudness?.data?.sections ??
      raw?.blocks?.sections?.data ??
      null;

    const sectionsKeys =
      sectionsData && typeof sectionsData === "object" ? Object.keys(sectionsData) : [];

    const thresholds =
      sectionsData && typeof sectionsData === "object" && (sectionsData as any).thresholds
        ? (sectionsData as any).thresholds
        : null;

    const pickSec = (name: "intro" | "drop" | "break" | "outro") => {
      const s = (sectionsData as any)?.[name];
      return s && typeof s === "object"
        ? {
            seconds: (s as any).seconds ?? null,
            mean_short_term_lufs: (s as any).mean_short_term_lufs ?? null,
            min_short_term_lufs: (s as any).min_short_term_lufs ?? null,
            max_short_term_lufs: (s as any).max_short_term_lufs ?? null,
          }
        : null;
    };

    const spectrumViewLen = (() => {
      const t = raw?.blocks?.timbre_spectrum?.data ?? null;
      const s = (t as any)?.spectrum_db;
      if (Array.isArray(s)) return s.length;
      if (s && typeof s === "object") {
        if (Array.isArray((s as any).track_db)) return (s as any).track_db.length;
        if (Array.isArray((s as any).track)) return (s as any).track.length;
        if (Array.isArray((s as any).view)) return (s as any).view.length;
      }
      return null;
    })();

    const correlationViewLen =
      Array.isArray((stereo as any)?.correlation_view) ? (stereo as any).correlation_view.length :
      Array.isArray((stereo as any)?.correlation) ? (stereo as any).correlation.length :
      null;

    const beatTimesViewLen =
      Array.isArray((rhy as any)?.beat_times_view) ? (rhy as any).beat_times_view.length :
      Array.isArray((rhy as any)?.beat_times) ? (rhy as any).beat_times.length :
      null;

    const arrays = raw?.arrays_blob && typeof raw.arrays_blob === "object" ? raw.arrays_blob : null;
    const loudFromArrays =
      arrays?.loudness_stats && typeof arrays.loudness_stats === "object"
        ? arrays.loudness_stats
        : null;

    const momentaryFromArrays = Array.isArray(loudFromArrays?.momentary_lufs)
      ? loudFromArrays.momentary_lufs.length
      : null;

    const shortTermFromArrays = Array.isArray(loudFromArrays?.short_term_lufs)
      ? loudFromArrays.short_term_lufs.length
      : null;

    const mfccMeanLen = (() => {
      if (!extra || typeof extra !== "object") return null;

      // legacy flat
      if (Array.isArray((extra as any).mfcc_mean)) return (extra as any).mfcc_mean.length;

      // V3 shape
      const mfcc = (extra as any).mfcc;
      if (mfcc && typeof mfcc === "object" && Array.isArray(mfcc.mean)) return mfcc.mean.length;

      return null;
    })();

    const spectralPeaksCount = (() => {
      if (!extra || typeof extra !== "object") return null;

      if (typeof (extra as any).spectral_peaks_count === "number") return (extra as any).spectral_peaks_count;

      const sp = (extra as any).spectral_peaks;
      if (Array.isArray(sp)) return sp.length;
      if (sp && typeof sp === "object" && typeof sp.count === "number") return sp.count;

      return null;
    })();

    const spectralPeaksEnergy = (() => {
      if (!extra || typeof extra !== "object") return null;

      // legacy flat
      if (typeof (extra as any).spectral_peaks_energy === "number") return (extra as any).spectral_peaks_energy;

      // V3 shape
      const sp = (extra as any).spectral_peaks;
      if (sp && typeof sp === "object" && typeof sp.energy === "number") return sp.energy;

      return null;
    })();

    const momentaryViewLen =
      Array.isArray((loud as any)?.momentary_lufs_view) ? (loud as any).momentary_lufs_view.length :
      Array.isArray((loud as any)?.momentary_lufs) ? (loud as any).momentary_lufs.length :
      null;

    const shortTermViewLen =
      Array.isArray((loud as any)?.short_term_lufs_view) ? (loud as any).short_term_lufs_view.length :
      Array.isArray((loud as any)?.short_term_lufs) ? (loud as any).short_term_lufs.length :
      null;

    const relativeKey =
      typeof (rhy as any)?.relative_key === "string" ? (rhy as any).relative_key :
      typeof (rhy as any)?.descriptors?.relative_key === "string" ? (rhy as any).descriptors.relative_key :
      null;

    console.log(`[${tag}] analyzer summary`, {
      version,
      profileKey,
      durationSec: raw?.meta?.duration_sec ?? null,
      tookMsTotal: raw?.meta?.took_ms_total ?? null,

      lufs: loud?.integrated_lufs ?? null,
      lra: loud?.lra ?? null,
      samplePeakDb: loud?.sample_peak_db ?? null,
      truePeakDb: loud?.true_peak_db ?? null,
      truePeakMethod: loud?.true_peak_method ?? null,

      momentaryViewLen,
      shortTermViewLen,
      momentaryArraysLen: momentaryFromArrays,
      shortTermArraysLen: shortTermFromArrays,
      momentaryPercentiles: loud?.momentary_percentiles ?? null,
      shortTermPercentiles: loud?.short_term_percentiles ?? null,

      sections: sectionsData && typeof sectionsData === "object"
        ? {
            keys: sectionsKeys,
            thresholds,
            intro: pickSec("intro"),
            drop: pickSec("drop"),
            break: pickSec("break"),
            outro: pickSec("outro"),
          }
        : null,

      // bands: preferisci timbre_spectrum, fallback legacy
      bandsNormKeys: timbreBands
        ? Object.keys(timbreBands)
        : bandsLegacy
          ? Object.keys(bandsLegacy)
          : [],

      spectrumViewLen,

      spectral: spec
        ? {
            centroidHz: spec.spectral_centroid_hz ?? null,
            rolloffHz: spec.spectral_rolloff_hz ?? null,
            bandwidthHz: spec.spectral_bandwidth_hz ?? null,
            flatness: spec.spectral_flatness ?? null,
            zcr: spec.zero_crossing_rate ?? null,
          }
        : null,

      stereoWidth: stereo?.stereo_width ?? null,
      widthByBandKeys: stereo?.width_by_band ? Object.keys(stereo.width_by_band) : [],
      stereoSummaryKeys: (() => {
        const stereoSummary = stereo?.stereo_summary ?? stereo?.summary ?? null;
        return stereoSummary ? Object.keys(stereoSummary) : [];
      })(),

      correlationViewLen,

      transients: trans
        ? {
            crestFactorDb: trans.crest_factor_db ?? null,
            transientStrength: trans.transient_strength ?? trans.strength ?? null,
            transientDensity: trans.transient_density ?? trans.density ?? null,
            logAttackTime: trans.log_attack_time ?? null,
          }
        : null,

      rhythm: rhy
        ? {
            bpm: rhy.bpm ?? null,
            key: rhy.key ?? null,
            relativeKey,
            danceability: rhy.danceability ?? null,
            descriptorsKeys: rhy.descriptors ? Object.keys(rhy.descriptors) : [],
            beatTimesViewLen,
          }
        : null,

      extra: extra
        ? {
            mfccMeanLen,
            hfc: (extra as any).hfc ?? null,
            spectralPeaksCount,
            spectralPeaksEnergy,
          }
        : null,
    });
  } catch (e) {
    console.log(`[${tag}] analyzer summary failed`, { err: String(e) });
  }
}
