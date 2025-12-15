import type { AnalyzerResult, AnalyzerV1Result, FixSuggestion } from "@/types/analyzer";
import type { BandKey, BandsNorm } from "@/lib/reference/types";
import { computeMixScores } from "@/lib/analyzer/computeMixScores";
import type { JsonObject } from "@/types/json";

import { isJsonObject } from "@/types/json";

type AnalyzerPayloadInput = AnalyzerResult | AnalyzerV1Result | JsonObject;

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
export function buildAnalyzerUpdatePayload(result: AnalyzerPayloadInput) {
  const resultObj = getObj(result);

  // --- Loudness (scalar) ---
  const loudnessStats = getObj(resultObj?.["loudness_stats"] ?? null);
  const integratedFromStats = getNum(loudnessStats, "integrated_lufs");
  const fallbackLufs =
    isAnalyzerResult(result) && isFiniteNumber(result.lufs) ? result.lufs : null;

  const lufs = integratedFromStats ?? fallbackLufs ?? null;

  // --- Spectral scalars ---
  const spectralObj = getObj(resultObj?.["spectral"] ?? null);
  const spectralCentroid =
    getNum(spectralObj, "spectral_centroid_hz") ??
    (isAnalyzerResult(result) ? result.spectral_centroid_hz : null);

  const spectralRolloff =
    getNum(spectralObj, "spectral_rolloff_hz") ??
    (isAnalyzerResult(result) ? result.spectral_rolloff_hz : null);

  const spectralBandwidth =
    getNum(spectralObj, "spectral_bandwidth_hz") ??
    (isAnalyzerResult(result) ? result.spectral_bandwidth_hz : null);

  const spectralFlatness =
    getNum(spectralObj, "spectral_flatness") ??
    (isAnalyzerResult(result) ? result.spectral_flatness : null);

  // --- Model match ---
  const modelMatchFromBody = getObj(resultObj?.["model_match"] ?? null);
  const modelMatchFromRef = getObj(resultObj?.["reference_ai"] ?? null);

  const modelMatchRatio =
    getNum(modelMatchFromBody, "match_ratio") ??
    getNum(modelMatchFromRef, "match_ratio");

  const modelMatchPercent =
    modelMatchRatio == null
      ? null
      : clamp(modelMatchRatio <= 1 ? modelMatchRatio * 100 : modelMatchRatio, 0, 100);

  // --- BPM / key ---
  const bpmValue =
    getNum(resultObj, "bpm") ?? (isAnalyzerResult(result) ? result.bpm : null);
  const analyzerBpm = isFiniteNumber(bpmValue) ? Math.round(bpmValue) : null;

  const rawAnalyzerKey = resultObj?.["key"] ?? (isAnalyzerResult(result) ? result.key : null);
  const analyzerKey =
    typeof rawAnalyzerKey === "string" && rawAnalyzerKey.trim().length > 0
      ? rawAnalyzerKey.trim()
      : null;

  // --- Score / feedback ---
  const overallScoreFromResult = isAnalyzerResult(result) ? result.overall_score : null;
  const overallScore =
    getNum(resultObj, "overall_score") ??
    (isFiniteNumber(overallScoreFromResult) ? overallScoreFromResult : null);

  const feedbackValue = resultObj?.["feedback"] ?? (isAnalyzerResult(result) ? result.feedback : null);
  const feedback = typeof feedbackValue === "string" ? feedbackValue : null;

  // --- Suggestions (small json) ---
  const fixSuggestions =
    isAnalyzerResult(result) && Array.isArray(result.fix_suggestions)
      ? result.fix_suggestions
      : Array.isArray(resultObj?.["fix_suggestions"])
      ? (resultObj?.["fix_suggestions"] as unknown as FixSuggestion[])
      : null;

  // --- Other scalar descriptor ---
  const zeroCrossingRate =
    getNum(resultObj, "zero_crossing_rate") ??
    (isAnalyzerResult(result) ? result.zero_crossing_rate : null);

  // --- Bands norm (light) ---
  // Nota: vogliamo estrarlo anche quando NON è AnalyzerResult “typed”
const analyzerBandsNorm =
  resultObj
    ? extractBandsNormFromAnalyzer(resultObj)
    : isAnalyzerResult(result)
    ? extractBandsNormFromAnalyzer(result)
    : {};


  const lra = loudnessStats ? getNum(loudnessStats, "lra") : null;
  const samplePeakDb = loudnessStats ? getNum(loudnessStats, "sample_peak_db") : null;

  const stereoWidth =
    getNum(resultObj, "stereo_width") ??
    (isAnalyzerResult(result) && typeof (result as any).stereo_width === "number"
      ? (result as any).stereo_width
      : null);

  const mixScores = computeMixScores({
    lufs,
    lra,
    samplePeakDb,
    spectralCentroidHz: spectralCentroid,
    spectralRolloffHz: spectralRolloff,
    spectralFlatness: spectralFlatness,
    stereoWidth,
    bandsNorm: analyzerBandsNorm,
    modelMatchPercent: modelMatchPercent,
  });

  // --- Waveform (UX) ---
  const waveformPeaksCandidate =
    resultObj?.["waveform_peaks"] ?? (isAnalyzerResult(result) ? result.waveform_peaks : null);

  const waveformPeaks =
    Array.isArray(waveformPeaksCandidate) && waveformPeaksCandidate.length
      ? waveformPeaksCandidate.filter((v): v is number => isFiniteNumber(v))
      : null;

  const waveformDurationRaw =
    getNum(resultObj, "waveform_duration") ??
    getNum(resultObj, "duration_seconds") ??
    (isAnalyzerResult(result) ? result.waveform_duration : null);

  const waveformDuration = isFiniteNumber(waveformDurationRaw) ? waveformDurationRaw : null;

  const waveformBandsObj = getObj(resultObj?.["waveform_bands"] ?? null);
  const waveformBands = waveformBandsObj
    ? (waveformBandsObj as AnalyzerResult["waveform_bands"])
    : null;

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
  const modeRaw = resultObj?.["mode"];
  const mode =
    typeof modeRaw === "string" && modeRaw.trim().length > 0 ? modeRaw.trim() : null;

  const warningsRaw = resultObj?.["warnings"];
  const warnings =
    Array.isArray(warningsRaw)
      ? warningsRaw.filter((w): w is string => typeof w === "string")
      : [];

  const analyzerJsonSummary: JsonObject = {
    bpm: bpmValue ?? null,
    key: analyzerKey,
    mode,
    spectral: spectralObj ?? null,
    confidence: getObj(resultObj?.["confidence"] ?? null) ?? null,
    warnings,
    loudness_stats: loudnessStats
      ? {
          integrated_lufs: integratedFromStats,
          lra: getNum(loudnessStats, "lra"),
          sample_peak_db: getNum(loudnessStats, "sample_peak_db"),
        }
      : null,
    model_match: mm && isJsonObject(mm)
      ? {
          match_ratio: getNum(mm, "match_ratio"),
          mean_abs_error: getNum(mm, "mean_abs_error"),
          deltas: getObj(mm["deltas"] ?? null) ?? null,
        }
      : null,
  };


  return {
    lufs,
    overall_score: mixScores.overall_score ?? overallScore,
    sub_clarity: mixScores.sub_clarity,
    hi_end: mixScores.hi_end,
    dynamics: mixScores.dynamics,
    stereo_image: mixScores.stereo_image,
    tonality: mixScores.tonality,
    feedback,

    model_match_percent: modelMatchPercent,

    // 👇 ridotto, non più result intero
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

    // 👇 rimossi finché non esiste un vero storage bucket usato dalla UI
    // arrays_blob_path: null,
    // arrays_blob_size_bytes: null,
    // analysis_pro: null,

    waveform_peaks: waveformPeaks,
    waveform_duration: waveformDuration,
    waveform_bands: waveformBands,

    analyzer_bands_norm: analyzerBandsNorm,
  };
}
