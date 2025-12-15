import type { AnalyzerResult, AnalyzerV1Result, FixSuggestion } from "@/types/analyzer";
import type { BandKey, BandsNorm } from "@/lib/reference/types";
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
  return (
    typeof value === "object" &&
    value !== null &&
    "overall_score" in value
  );
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
 * Mapping risultato Tekkin Analyzer -> colonne project_versions.
 */
export function buildAnalyzerUpdatePayload(result: AnalyzerPayloadInput) {
  const resultObj = getObj(result);

  const loudnessStats = getObj(resultObj?.["loudness_stats"] ?? null);
  const integratedFromStats = getNum(loudnessStats, "integrated_lufs");
  const fallbackLufs =
    isAnalyzerResult(result) && isFiniteNumber(result.lufs) ? result.lufs : null;

  const lufs = integratedFromStats ?? fallbackLufs ?? null;

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

  const modelMatchFromBody = getObj(resultObj?.["model_match"] ?? null);
  const modelMatchFromRef = getObj(resultObj?.["reference_ai"] ?? null);
  const modelMatchRatio =
    getNum(modelMatchFromBody, "match_ratio") ??
    getNum(modelMatchFromRef, "match_ratio");
  const modelMatchPercent =
    modelMatchRatio == null
      ? null
      : clamp(
          modelMatchRatio <= 1 ? modelMatchRatio * 100 : modelMatchRatio,
          0,
          100
        );

  const bpmValue =
    getNum(resultObj, "bpm") ?? (isAnalyzerResult(result) ? result.bpm : null);
  const effectiveBpm = isFiniteNumber(bpmValue) ? Math.round(bpmValue) : null;

  const rawAnalyzerKey =
    resultObj?.["key"] ?? (isAnalyzerResult(result) ? result.key : null);
  const analyzerKey =
    typeof rawAnalyzerKey === "string" && rawAnalyzerKey.trim().length > 0
      ? rawAnalyzerKey.trim()
      : null;

  const arraysBlobPathRaw =
    resultObj?.["arrays_blob_path"] ??
    (isAnalyzerResult(result) ? result.arrays_blob_path : null);
  const arraysBlobPath =
    typeof arraysBlobPathRaw === "string" && arraysBlobPathRaw.trim().length > 0
      ? arraysBlobPathRaw.trim()
      : null;

  const arraysBlobSizeRaw =
    getNum(resultObj, "arrays_blob_size_bytes") ??
    (isAnalyzerResult(result) ? result.arrays_blob_size_bytes : null);
  const arraysBlobSize = isFiniteNumber(arraysBlobSizeRaw)
    ? Math.round(arraysBlobSizeRaw)
    : null;

  const waveformPeaksCandidate =
    resultObj?.["waveform_peaks"] ??
    (isAnalyzerResult(result) ? result.waveform_peaks : null);
  const waveformPeaks =
    Array.isArray(waveformPeaksCandidate) && waveformPeaksCandidate.length
      ? waveformPeaksCandidate.filter((v): v is number => isFiniteNumber(v))
      : null;

  const waveformDurationRaw =
    getNum(resultObj, "waveform_duration") ??
    (isAnalyzerResult(result) ? result.waveform_duration : null);
  const waveformDuration = isFiniteNumber(waveformDurationRaw)
    ? waveformDurationRaw
    : null;

  const waveformBandsObj = getObj(resultObj?.["waveform_bands"] ?? null);
  const waveformBands = waveformBandsObj
    ? (waveformBandsObj as AnalyzerResult["waveform_bands"])
    : null;

  const analysisPro = isAnalyzerResult(result) ? result.analysis_pro ?? null : null;

  const feedbackValue =
    resultObj?.["feedback"] ??
    (isAnalyzerResult(result) ? result.feedback : null);
  const feedback =
    typeof feedbackValue === "string" ? feedbackValue : null;

  const overallScoreFromResult = isAnalyzerResult(result)
    ? result.overall_score
    : null;
  const overallScore =
    getNum(resultObj, "overall_score") ??
    (isFiniteNumber(overallScoreFromResult) ? overallScoreFromResult : null);

  const fixSuggestions =
    isAnalyzerResult(result) && Array.isArray(result.fix_suggestions)
      ? result.fix_suggestions
      : Array.isArray(resultObj?.["fix_suggestions"])
      ? (resultObj["fix_suggestions"] as unknown as FixSuggestion[])
      : null;

  const zeroCrossingRate =
    getNum(resultObj, "zero_crossing_rate") ??
    (isAnalyzerResult(result) ? result.zero_crossing_rate : null);

  const analyzerReferenceAi = resultObj?.["model_match"] ?? null;

  const analyzerBandsNorm = isAnalyzerResult(result)
    ? extractBandsNormFromAnalyzer(result)
    : {};

  return {
    lufs,
    overall_score: overallScore,
    feedback,

    model_match_percent: modelMatchPercent,

    analyzer_json: result,

    analyzer_reference_ai: analyzerReferenceAi ?? null,

    analysis_pro: analysisPro,

    analyzer_bpm: effectiveBpm,
    analyzer_spectral_centroid_hz: spectralCentroid,
    analyzer_spectral_rolloff_hz: spectralRolloff,
    analyzer_spectral_bandwidth_hz: spectralBandwidth,
    analyzer_spectral_flatness: spectralFlatness,
    analyzer_zero_crossing_rate: zeroCrossingRate,
    analyzer_key: analyzerKey,

    fix_suggestions: fixSuggestions,
    arrays_blob_path: arraysBlobPath,
    arrays_blob_size_bytes: arraysBlobSize,

    waveform_peaks: waveformPeaks,
    waveform_duration: waveformDuration,
    waveform_bands: waveformBands,

    analyzer_bands_norm: analyzerBandsNorm,
  };
}
