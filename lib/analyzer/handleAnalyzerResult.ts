import type { AnalyzerResult, FixSuggestion } from "@/types/analyzer";
import type { BandKey, BandsNorm } from "@/lib/reference/types";
import { computeMixScores } from "@/lib/analyzer/computeMixScores";
import type { JsonObject } from "@/types/json";
import { adaptAnalyzerV3ToLegacy } from "@/lib/analyzer/v3/adaptV3ToLegacy";

import { isJsonObject } from "@/types/json";

type AnalyzerPayloadInput = AnalyzerResult | JsonObject;

type RawAnalyzerLike = AnalyzerResult | JsonObject;

type AnalyzerUpdatePayload = {
  lufs: number | null;
  overall_score: number | null;
  sub_clarity: number | null;
  hi_end: number | null;
  dynamics: number | null;
  stereo_image: number | null;
  tonality: number | null;
  feedback: string | null;

  model_match_percent: number | null;

  analyzer_json: JsonObject;
  analyzer_reference_ai: JsonObject | null;

  analyzer_bpm: number | null;
  analyzer_spectral_centroid_hz: number | null;
  analyzer_spectral_rolloff_hz: number | null;
  analyzer_spectral_bandwidth_hz: number | null;
  analyzer_spectral_flatness: number | null;
  analyzer_zero_crossing_rate: number | null;
  analyzer_key: string | null;

  fix_suggestions: FixSuggestion[] | null;

  analyzer_bands_norm: BandsNorm;

  analyzer_profile_key: string | null;

  arrays_blob_path?: string;
  arrays_blob_size_bytes?: number;

  waveform_peaks?: number[];
  waveform_duration?: number;
  waveform_bands?: JsonObject;
};

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function getObj(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null;
}

function getNum(obj: JsonObject | null, key: string): number | null {
  if (!obj) return null;
  const v = obj[key];
  return isFiniteNumber(v) ? v : null;
}

function isAnalyzerResult(value: AnalyzerPayloadInput): value is AnalyzerResult {
  return typeof value === "object" && value !== null && "overall_score" in value;
}

const BAND_KEYS: BandKey[] = ["sub", "low", "lowmid", "mid", "presence", "high", "air"];
type AnyObj = Record<string, unknown>;

function sanitizePercentileRange3(input: unknown): JsonObject | null {
  const o = getObj(input);
  if (!o) return null;

  const p10 = getNum(o, "p10");
  const p50 = getNum(o, "p50");
  const p90 = getNum(o, "p90");

  if (p10 == null && p50 == null && p90 == null) return null;
  return { p10, p50, p90 };
}

function sanitizeLoudnessSection(input: unknown): JsonObject | null {
  const o = getObj(input);
  if (!o) return null;

  const seconds = getNum(o, "seconds");
  const mean = getNum(o, "mean_short_term_lufs");
  const min = getNum(o, "min_short_term_lufs");
  const max = getNum(o, "max_short_term_lufs");

  if (seconds == null && mean == null && min == null && max == null) return null;

  return {
    seconds,
    mean_short_term_lufs: mean,
    min_short_term_lufs: min,
    max_short_term_lufs: max,
  };
}

function sanitizeLoudnessSections(input: unknown): JsonObject | null {
  const o = getObj(input);
  if (!o) return null;

  const intro = sanitizeLoudnessSection((o as AnyObj)["intro"]);
  const drop = sanitizeLoudnessSection((o as AnyObj)["drop"]);
  const brk = sanitizeLoudnessSection((o as AnyObj)["break"]);
  const outro = sanitizeLoudnessSection((o as AnyObj)["outro"]);

  const thresholdsObj = getObj((o as AnyObj)["thresholds"] ?? null);
  const thresholds = thresholdsObj
    ? { p30: getNum(thresholdsObj, "p30"), p70: getNum(thresholdsObj, "p70") }
    : null;

  if (!intro && !drop && !brk && !outro && !thresholds) return null;

  return {
    thresholds,
    intro,
    drop,
    break: brk,
    outro,
  };
}

function sanitizeBands(input: unknown): JsonObject | null {
  const o = getObj(input);
  if (!o) return null;

  const out: JsonObject = {};
  for (const k of BAND_KEYS) {
    const v = (o as AnyObj)[k];
    if (isFiniteNumber(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeNumberRecord(input: unknown): JsonObject | null {
  const o = getObj(input);
  if (!o) return null;

  const out: JsonObject = {};
  for (const [k, v] of Object.entries(o)) {
    if (isFiniteNumber(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeNumberArray(input: unknown, maxLen: number): number[] | null {
  if (!Array.isArray(input)) return null;
  const out = input.filter((v): v is number => isFiniteNumber(v)).slice(0, maxLen);
  return out.length ? out : null;
}


export function extractBandsNormFromAnalyzer(result: AnalyzerResult | JsonObject): BandsNorm {
  const resultObj = (isJsonObject(result) ? result : null) as JsonObject | null;
  if (!resultObj) return {};

  const rootBands = getObj(resultObj["band_energy_norm"] ?? null);
  if (rootBands) {
    const normalized: BandsNorm = {};
    for (const key of BAND_KEYS) {
      const v = rootBands[key];
      if (isFiniteNumber(v)) normalized[key] = v;
    }
    return normalized;
  }

  // V3: blocks.tonal_balance.data.band_energy_norm
  const blocks = getObj(resultObj["blocks"] ?? null);
  const tonalBlock = blocks ? getObj(blocks["tonal_balance"] ?? null) : null;
  const tonalData = tonalBlock ? getObj(tonalBlock["data"] ?? null) : null;
  const tonalBands = tonalData ? getObj(tonalData["band_energy_norm"] ?? null) : null;
  if (tonalBands) {
    const normalized: BandsNorm = {};
    for (const key of BAND_KEYS) {
      const v = tonalBands[key];
      if (isFiniteNumber(v)) normalized[key] = v;
    }
    if (Object.keys(normalized).length > 0) return normalized;
  }

  // V3: blocks.timbre_spectrum.data.bands_norm (SOURCE REALE V3)
  const timbreBlock = blocks ? getObj((blocks as any)["timbre_spectrum"] ?? null) : null;
  const timbreData = timbreBlock ? getObj((timbreBlock as any)["data"] ?? null) : null;
  const timbreBands = timbreData ? getObj((timbreData as any)["bands_norm"] ?? null) : null;

  if (timbreBands) {
    const normalized: BandsNorm = {};
    for (const key of BAND_KEYS) {
      const v = (timbreBands as any)[key];
      if (isFiniteNumber(v)) normalized[key] = v;
    }
    if (Object.keys(normalized).length > 0) return normalized;
  }

  // V3 fallback: blocks.bands_norm.data (se l'adapter non ha portato su band_energy_norm)
  const bandsBlock = blocks ? getObj(blocks["bands_norm"] ?? null) : null;
  const bandsData = bandsBlock ? getObj(bandsBlock["data"] ?? null) : null;
  if (bandsData) {
    const normalized: BandsNorm = {};
    for (const key of BAND_KEYS) {
      const v = (bandsData as any)[key];
      if (isFiniteNumber(v)) normalized[key] = v;
    }
    if (Object.keys(normalized).length > 0) return normalized;
  }

  // V3: blocks.spectral.data.band_norm
  const spectralBlock = blocks ? getObj((blocks as any)["spectral"] ?? null) : null;
  const spectralData = spectralBlock ? getObj((spectralBlock as any)["data"] ?? null) : null;
  const spectralBands = spectralData ? getObj((spectralData as any)["band_norm"] ?? null) : null;
  if (spectralBands) {
    const normalized: BandsNorm = {};
    for (const key of BAND_KEYS) {
      const v = (spectralBands as any)[key];
      if (isFiniteNumber(v)) normalized[key] = v;
    }
    if (Object.keys(normalized).length > 0) return normalized;
  }

  const spectralRaw = getObj(resultObj?.["spectral"] ?? null);
  const bandNormRaw = spectralRaw ? getObj(spectralRaw["band_norm"] ?? null) : null;
  if (!bandNormRaw) return {};

  const normalized: BandsNorm = {};
  for (const key of BAND_KEYS) {
    const v = bandNormRaw[key];
    if (isFiniteNumber(v)) normalized[key] = v;
  }
  return normalized;
}

/**
 * Mapping risultato Tekkin Analyzer -> colonne project_versions (LIGHT).
 * Regole:
 * - Niente array pesanti in DB dentro analyzer_json.
 * - Niente arrays_blob_path/size finché non c'è un vero bucket + fetch UI.
 * - Waveform peaks/bands ok (downsampled) perché UX.
 */
export function buildAnalyzerUpdatePayload(result: RawAnalyzerLike): AnalyzerUpdatePayload {
  const resultObj = getObj(result);

  // V3 adapter: se arriva payload con version=v3 e blocks.*, lo normalizziamo alla shape legacy
  const v3Version = resultObj?.["version"];
  const hasBlocks = !!getObj(resultObj?.["blocks"] ?? null);

  const normalizedObj =
  resultObj && v3Version === "v3" && hasBlocks ? adaptAnalyzerV3ToLegacy(resultObj) : resultObj;


  // --- Loudness (scalar) ---
  const loudnessStats = getObj(normalizedObj?.["loudness_stats"] ?? null);
  const integratedFromStats = getNum(loudnessStats, "integrated_lufs");
  const fallbackLufs =
    isAnalyzerResult(result) && isFiniteNumber(result.lufs) ? result.lufs : null;

  const lufs = integratedFromStats ?? fallbackLufs ?? null;

  // --- Spectral scalars ---
  // Fonte primaria: normalizedObj.spectral (legacy)
  // V3 fallback: blocks.spectral.data
  const spectralObj = getObj(normalizedObj?.["spectral"] ?? null);
  const v3SpectralData = getPathObj(resultObj, ["blocks", "spectral", "data"]);

  const spectralCentroid =
    getNum(spectralObj, "spectral_centroid_hz") ??
    getNum(v3SpectralData, "spectral_centroid_hz") ??
    getNum(v3SpectralData, "centroid_hz") ??
    getNum(v3SpectralData, "spectral_centroid") ??
    getNum(normalizedObj, "spectral_centroid_hz") ??
    (isAnalyzerResult(result) ? result.spectral_centroid_hz : null);

  const spectralRolloff =
    getNum(spectralObj, "spectral_rolloff_hz") ??
    getNum(v3SpectralData, "spectral_rolloff_hz") ??
    getNum(v3SpectralData, "rolloff_hz") ??
    getNum(v3SpectralData, "spectral_rolloff") ??
    getNum(normalizedObj, "spectral_rolloff_hz") ??
    (isAnalyzerResult(result) ? result.spectral_rolloff_hz : null);

  const spectralBandwidth =
    getNum(spectralObj, "spectral_bandwidth_hz") ??
    getNum(v3SpectralData, "spectral_bandwidth_hz") ??
    getNum(v3SpectralData, "bandwidth_hz") ??
    getNum(v3SpectralData, "spectral_bandwidth") ??
    getNum(normalizedObj, "spectral_bandwidth_hz") ??
    (isAnalyzerResult(result) ? result.spectral_bandwidth_hz : null);

  const spectralFlatness =
    getNum(spectralObj, "spectral_flatness") ??
    getNum(v3SpectralData, "spectral_flatness") ??
    getNum(v3SpectralData, "flatness") ??
    getNum(normalizedObj, "spectral_flatness") ??
    (isAnalyzerResult(result) ? result.spectral_flatness : null);

  // --- Model match ---
  const modelMatchFromBody = getObj(normalizedObj?.["model_match"] ?? null);
  const modelMatchFromRef = getObj(normalizedObj?.["reference_ai"] ?? null);

  const modelMatchRatio =
    getNum(modelMatchFromBody, "match_ratio") ??
    getNum(modelMatchFromRef, "match_ratio");

  const modelMatchPercent =
    modelMatchRatio == null
      ? null
      : clamp(modelMatchRatio <= 1 ? modelMatchRatio * 100 : modelMatchRatio, 0, 100);

    // --- BPM / key ---
  // v3: blocks.rhythm.data.{bpm,key}
  const v3RhythmData = getPathObj(resultObj, ["blocks", "rhythm", "data"]);

  const bpmValue =
    getNum(normalizedObj, "bpm") ??
    getNum(v3RhythmData, "bpm") ??
    (isAnalyzerResult(result) ? result.bpm : null);

  const analyzerBpm = isFiniteNumber(bpmValue) ? Math.round(bpmValue) : null;

  const rawAnalyzerKey =
    normalizedObj?.["key"] ??
    (v3RhythmData ? v3RhythmData["key"] : null) ??
    (isAnalyzerResult(result) ? result.key : null);

  const analyzerKey =
    typeof rawAnalyzerKey === "string" && rawAnalyzerKey.trim().length > 0
      ? rawAnalyzerKey.trim()
      : null;


  // --- Score / feedback ---
  const overallScoreFromResult = isAnalyzerResult(result) ? result.overall_score : null;
  const overallScore =
    getNum(normalizedObj, "overall_score") ??
    (isFiniteNumber(overallScoreFromResult) ? overallScoreFromResult : null);

  const feedbackValue = normalizedObj?.["feedback"] ?? (isAnalyzerResult(result) ? result.feedback : null);
  const feedback = typeof feedbackValue === "string" ? feedbackValue : null;

  // --- Suggestions (small json) ---
  const fixSuggestions =
    isAnalyzerResult(result) && Array.isArray(result.fix_suggestions)
      ? result.fix_suggestions
      : Array.isArray(normalizedObj?.["fix_suggestions"])
      ? (normalizedObj?.["fix_suggestions"] as unknown as FixSuggestion[])
      : null;

  // --- Other scalar descriptor ---
  // Nel payload v2 è dentro spectral.zero_crossing_rate, il top-level può essere null
  const zeroCrossingRate =
    getNum(spectralObj, "zero_crossing_rate") ??
    getNum(v3SpectralData, "zero_crossing_rate") ??
    getNum(v3SpectralData, "zcr") ??
    getNum(normalizedObj, "zero_crossing_rate") ??
    (isAnalyzerResult(result) ? result.zero_crossing_rate : null);

  // --- Bands norm (light) ---
  // V3: leggi SEMPRE dal raw resultObj (che contiene blocks.timbre_spectrum)
  // Legacy: usa normalizedObj
  let analyzerBandsNorm: BandsNorm = {};

  if (resultObj && resultObj["version"] === "v3") {
    analyzerBandsNorm = extractBandsNormFromAnalyzer(resultObj);
  } else if (normalizedObj) {
    analyzerBandsNorm = extractBandsNormFromAnalyzer(normalizedObj);
  } else if (isAnalyzerResult(result)) {
    analyzerBandsNorm = extractBandsNormFromAnalyzer(result);
  }

  console.log("[debug] bands_norm keys:", Object.keys(analyzerBandsNorm || {}));

  const lra = loudnessStats ? getNum(loudnessStats, "lra") : null;
  const samplePeakDb = loudnessStats ? getNum(loudnessStats, "sample_peak_db") : null;
  const stereoWidth =
    getNum(normalizedObj, "stereo_width") ??
    (isAnalyzerResult(result) && typeof (result as any).stereo_width === "number"
      ? (result as any).stereo_width
      : typeof (resultObj as any)?.blocks?.stereo?.data?.stereo_width === "number"
        ? (resultObj as any).blocks.stereo.data.stereo_width
        : null);

  const mixScores = computeMixScores({
    lufs,
    lra,
    samplePeakDb,
    spectralCentroidHz: spectralCentroid,
    spectralRolloffHz: spectralRolloff,
    spectralBandwidthHz: spectralBandwidth,
    spectralFlatness: spectralFlatness,
    zeroCrossingRate,
    stereoWidth,
    bandsNorm: analyzerBandsNorm,
    modelMatchPercent: modelMatchPercent,
  });

  // --- Waveform (UX) ---
  const waveformPeaksCandidate =
    normalizedObj?.["waveform_peaks"] ??
    resultObj?.["waveform_peaks"] ??
    (isAnalyzerResult(result) ? result.waveform_peaks : null);

  const waveformPeaks =
    Array.isArray(waveformPeaksCandidate) && waveformPeaksCandidate.length
      ? waveformPeaksCandidate.filter((v): v is number => isFiniteNumber(v))
      : null;

  const waveformDurationRaw =
    getNum(normalizedObj, "waveform_duration") ??
    getNum(resultObj, "waveform_duration") ??
    getNum(normalizedObj, "duration_seconds") ??
    getNum(resultObj, "duration_seconds") ??
    (isAnalyzerResult(result) ? result.waveform_duration : null);

  const waveformDuration = isFiniteNumber(waveformDurationRaw) ? waveformDurationRaw : null;

  const waveformBandsObj =
    getObj(normalizedObj?.["waveform_bands"] ?? null) ?? getObj(resultObj?.["waveform_bands"] ?? null);

  // --- analyzer_reference_ai (small, consistent) ---
  // Preferiamo model_match (body) e normalizziamo il payload (solo campi piccoli)
  const mm = modelMatchFromBody ?? modelMatchFromRef;
  const analyzerReferenceAi =
    mm && isJsonObject(mm)
      ? {
          match_ratio: getNum(mm, "match_ratio"),
          mean_abs_error: getNum(mm, "mean_abs_error"),
          deltas: getObj(mm["deltas"] ?? null) ?? null,
        }
      : null;

  // --- analyzer_json (SUMMARY ONLY) ---
  // Qui evitiamo di salvare `result` intero, che contiene roba pesante (beats, arrays_blob, ecc.).
  const modeRaw = normalizedObj?.["mode"];
  const mode =
    typeof modeRaw === "string" && modeRaw.trim().length > 0 ? modeRaw.trim() : null;

  const warningsRaw = normalizedObj?.["warnings"];
  const warnings =
    Array.isArray(warningsRaw)
      ? warningsRaw.filter((w): w is string => typeof w === "string")
      : [];

  const spectralSummary: JsonObject = {
    spectral_centroid_hz: spectralCentroid,
    spectral_rolloff_hz: spectralRolloff,
    spectral_flatness: spectralFlatness,
    spectral_bandwidth_hz: spectralBandwidth,
    zero_crossing_rate: zeroCrossingRate,
  };

  const analyzerProfileKey =
    typeof normalizedObj?.profile_key === "string"
      ? normalizedObj.profile_key
      : typeof normalizedObj?.profileKey === "string"
      ? normalizedObj.profileKey
      : null;

  // --- transients (SMALL) ---
  const arraysBlobObj =
    getObj(resultObj?.["arrays_blob"] ?? null) ??
    getObj(normalizedObj?.["arrays_blob"] ?? null);

  const transientsObj =
    getObj(arraysBlobObj?.["transients"] ?? null) ??
    getObj(normalizedObj?.["transients"] ?? null);

  const strength = transientsObj
    ? getNum(transientsObj, "strength") ??
      getNum(transientsObj, "transient_strength")
    : null;

  const density = transientsObj
    ? getNum(transientsObj, "density") ??
      getNum(transientsObj, "transient_density")
    : null;

  const transientsSummary: JsonObject | null =
    transientsObj && (strength != null || density != null)
      ? {
          strength,
          density,
          crest_factor_db: getNum(transientsObj, "crest_factor_db"),
          log_attack_time: getNum(transientsObj, "log_attack_time"),
        }
      : null;

  // --- Loudness percentiles / sections (SMALL) [sanitized] ---
  const momentaryPercentilesRaw =
    getObj(normalizedObj?.["momentary_percentiles"] ?? null) ??
    getObj(resultObj?.["momentary_percentiles"] ?? null) ??
    getPathObj(resultObj, ["blocks", "loudness", "data", "momentary_percentiles"]);

  const shortTermPercentilesRaw =
    getObj(normalizedObj?.["short_term_percentiles"] ?? null) ??
    getObj(resultObj?.["short_term_percentiles"] ?? null) ??
    getPathObj(resultObj, ["blocks", "loudness", "data", "short_term_percentiles"]);

  const sectionsRaw =
    getObj(normalizedObj?.["sections"] ?? null) ??
    getObj(resultObj?.["sections"] ?? null) ??
    getObj((resultObj as any)?.blocks?.sections?.data ?? null);

  const momentaryPercentiles = sanitizePercentileRange3(momentaryPercentilesRaw);
  const shortTermPercentiles = sanitizePercentileRange3(shortTermPercentilesRaw);
  const sectionsObj = sanitizeLoudnessSections(sectionsRaw);

  // --- Stereo small (SMALL) [sanitized] ---
  const widthByBandRaw =
    getObj(normalizedObj?.["width_by_band"] ?? null) ??
    getObj(resultObj?.["width_by_band"] ?? null) ??
    getPathObj(resultObj, ["blocks", "stereo", "data", "width_by_band"]);

  const stereoSummaryRaw =
    getObj(normalizedObj?.["stereo_summary"] ?? null) ??
    getObj(resultObj?.["stereo_summary"] ?? null) ??
    getPathObj(resultObj, ["blocks", "stereo", "data", "stereo_summary"]);

  const widthByBandObj = sanitizeBands(widthByBandRaw);
  const stereoSummaryObj = sanitizeNumberRecord(stereoSummaryRaw);

  // --- Rhythm small (SMALL) [sanitized] ---
  const relativeKeyValue =
    (normalizedObj as any)?.["relative_key"] ??
    (resultObj as any)?.["relative_key"] ??
    (resultObj as any)?.blocks?.rhythm?.data?.relative_key ??
    null;

  const relativeKey =
    typeof relativeKeyValue === "string" && relativeKeyValue.trim().length > 0
      ? relativeKeyValue.trim()
      : null;

  const danceability =
    getNum(normalizedObj as any, "danceability") ??
    getNum(resultObj as any, "danceability") ??
    (typeof (resultObj as any)?.blocks?.rhythm?.data?.danceability === "number"
      ? (resultObj as any).blocks.rhythm.data.danceability
      : null);

  const rhythmDescriptorsRaw =
    getObj(normalizedObj?.["rhythm_descriptors"] ?? null) ??
    getObj(resultObj?.["rhythm_descriptors"] ?? null) ??
    getObj((resultObj as any)?.blocks?.rhythm?.data?.descriptors ?? null);

  const rhythmDescriptorsObj = sanitizeNumberRecord(rhythmDescriptorsRaw);

  // --- EXTRA (MFCC, HFC, SPECTRAL PEAKS) ---

  const extraObj =
    getObj(normalizedObj?.["extra"] ?? null) ??
    getObj(resultObj?.["extra"] ?? null) ??
    getObj((resultObj as any)?.blocks?.extra?.data ?? null);

  // MFCC: supporta sia shape vecchia (mfcc_mean) che V3 (mfcc.mean) -> sanitize to 13 values
  const mfccMean =
    extraObj && Array.isArray((extraObj as any)["mfcc_mean"])
      ? sanitizeNumberArray((extraObj as any)["mfcc_mean"], 13)
      : (() => {
          const mfcc = getObj((extraObj as any)?.mfcc ?? null);
          return sanitizeNumberArray(mfcc ? (mfcc as any).mean : null, 13);
        })();

  const hfc = extraObj ? getNum(extraObj, "hfc") : null;

  const spectralPeaksCount =
    extraObj && isFiniteNumber((extraObj as any)["spectral_peaks_count"])
      ? (extraObj as any)["spectral_peaks_count"]
      : (() => {
          const sp = getObj((extraObj as any)?.spectral_peaks ?? null);
          const c = sp ? (sp as any).count : null;
          return isFiniteNumber(c) ? c : null;
        })();

  const spectralPeaksEnergy =
    extraObj && isFiniteNumber((extraObj as any)["spectral_peaks_energy"])
      ? (extraObj as any)["spectral_peaks_energy"]
      : (() => {
          const sp = getObj((extraObj as any)?.spectral_peaks ?? null);
          const e = sp ? (sp as any).energy : null;
          return isFiniteNumber(e) ? e : null;
        })();

  const analyzerJsonSummary: JsonObject = {
    bpm: analyzerBpm,

    key: analyzerKey,
    mode,
    profile_key: analyzerProfileKey,
    spectral: spectralSummary,
    confidence: getObj(normalizedObj?.["confidence"] ?? null) ?? null,
    warnings,
    loudness_stats: loudnessStats
      ? {
          integrated_lufs: integratedFromStats ?? lufs,
          lra: getNum(loudnessStats, "lra"),
          sample_peak_db: getNum(loudnessStats, "sample_peak_db"),
          true_peak_db: getNum(loudnessStats, "true_peak_db"),
true_peak_method: (() => {
  const v = loudnessStats ? (loudnessStats as AnyObj)["true_peak_method"] : null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
})(),
        }
      : null,

    momentary_percentiles: momentaryPercentiles,
    short_term_percentiles: shortTermPercentiles,
    sections: sectionsObj,

    transients: transientsSummary,

    stereo: {
      stereo_width: stereoWidth,
      width_by_band: widthByBandObj,
      summary: stereoSummaryObj,
    },

    rhythm: {
      relative_key: relativeKey,
      danceability,
      descriptors: rhythmDescriptorsObj,
    },

    extra: {
      mfcc_mean: mfccMean,
      hfc,
      spectral_peaks_count: spectralPeaksCount,
      spectral_peaks_energy: spectralPeaksEnergy,
    },
  };

const out: AnalyzerUpdatePayload = {
  lufs,
  overall_score: mixScores.overall_score ?? overallScore,
  sub_clarity: mixScores.sub_clarity,
  hi_end: mixScores.hi_end,
  dynamics: mixScores.dynamics,
  stereo_image: mixScores.stereo_image,
  tonality: mixScores.tonality,
  feedback,

  model_match_percent: modelMatchPercent,

  analyzer_json: analyzerJsonSummary,
  analyzer_reference_ai: analyzerReferenceAi,

  analyzer_bpm: analyzerBpm,
  analyzer_spectral_centroid_hz: spectralCentroid,
  analyzer_spectral_rolloff_hz: spectralRolloff,
  analyzer_spectral_bandwidth_hz: spectralBandwidth,
  analyzer_spectral_flatness: spectralFlatness,
  analyzer_zero_crossing_rate: zeroCrossingRate,
  analyzer_key: analyzerKey,

  fix_suggestions: fixSuggestions,

  analyzer_bands_norm: analyzerBandsNorm,

    analyzer_profile_key: analyzerProfileKey,
};
const arraysBlobPath =
  typeof resultObj?.["arrays_blob_path"] === "string"
    ? (resultObj["arrays_blob_path"] as string)
    : typeof normalizedObj?.["arrays_blob_path"] === "string"
      ? (normalizedObj["arrays_blob_path"] as string)
      : null;

const arraysBlobSize =
  typeof resultObj?.["arrays_blob_size_bytes"] === "number"
    ? (resultObj["arrays_blob_size_bytes"] as number)
    : typeof normalizedObj?.["arrays_blob_size_bytes"] === "number"
      ? (normalizedObj["arrays_blob_size_bytes"] as number)
      : null;

if (arraysBlobPath) out.arrays_blob_path = arraysBlobPath;
if (typeof arraysBlobSize === "number" && Number.isFinite(arraysBlobSize) && arraysBlobSize > 0) {
  out.arrays_blob_size_bytes = arraysBlobSize;
}

// Waveform: non azzerare in DB se manca
if (Array.isArray(waveformPeaks) && waveformPeaks.length > 0) {
  out.waveform_peaks = waveformPeaks;
}
if (isFiniteNumber(waveformDuration) && waveformDuration > 0) {
  out.waveform_duration = waveformDuration;
}
if (waveformBandsObj) {
  out.waveform_bands = waveformBandsObj;
}


return out;

 
}

function getPath(obj: unknown, path: readonly string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    const o = getObj(cur);
    if (!o) return null;
    cur = o[key];
  }
  return cur ?? null;
}

function getPathObj(obj: unknown, path: readonly string[]): JsonObject | null {
  return getObj(getPath(obj, path));
}

function _getPathNum(obj: unknown, path: readonly string[]): number | null {
  const v = getPath(obj, path);
  return isFiniteNumber(v) ? v : null;
}
