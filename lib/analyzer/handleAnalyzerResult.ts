import type { AnalyzerResult } from "@/types/analyzer";
import type { BandKey, BandsNorm } from "@/lib/reference/types";

type AnyRecord = Record<string, unknown>;

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function getObj(x: unknown): AnyRecord | null {
  return x && typeof x === "object" ? (x as AnyRecord) : null;
}

function getNum(obj: unknown, key: string): number | null {
  const o = getObj(obj);
  const v = o ? o[key] : null;
  return isFiniteNumber(v) ? v : null;
}

const BAND_KEYS: BandKey[] = ["sub", "low", "lowmid", "mid", "presence", "high", "air"];

export function extractBandsNormFromAnalyzer(result: AnalyzerResult): BandsNorm {
  const anyR = result as unknown as AnyRecord;

  const rootBands = getObj(anyR.band_energy_norm);
  if (rootBands) {
    const normalized: BandsNorm = {};
    for (const key of BAND_KEYS) {
      const v = rootBands[key];
      if (isFiniteNumber(v)) normalized[key] = v;
    }
    return normalized;
  }

  const spectralRaw = getObj(anyR.spectral);
  const bandNormRaw = spectralRaw ? getObj((spectralRaw as AnyRecord).band_norm) : null;
  if (!bandNormRaw) return {};

  const normalized: BandsNorm = {};
  for (const key of BAND_KEYS) {
    const v = (bandNormRaw as AnyRecord)[key];
    if (isFiniteNumber(v)) normalized[key] = v;
  }
  return normalized;
}

/**
 * Mapping risultato Tekkin Analyzer -> colonne project_versions.
 */
export function buildAnalyzerUpdatePayload(result: AnalyzerResult) {
  const resultAny = result as unknown as AnyRecord;

  // loudness_stats.integrated_lufs (nuovo) fallback a result.lufs (vecchio)
  const integratedFromStats = (() => {
    const ls = (result as any)?.loudness_stats;
    const v = ls?.integrated_lufs;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  })();

  const lufs = integratedFromStats;

  // spectral nested (nuovo) fallback ai campi flat (vecchio)
  const spectralObj = getObj(resultAny.spectral);
  const spectralCentroid =
    getNum(spectralObj, "spectral_centroid_hz") ??
    (isFiniteNumber((result as any).spectral_centroid_hz) ? (result as any).spectral_centroid_hz : null);

  const spectralRolloff =
    getNum(spectralObj, "spectral_rolloff_hz") ??
    (isFiniteNumber((result as any).spectral_rolloff_hz) ? (result as any).spectral_rolloff_hz : null);

  const spectralBandwidth =
    getNum(spectralObj, "spectral_bandwidth_hz") ??
    (isFiniteNumber((result as any).spectral_bandwidth_hz) ? (result as any).spectral_bandwidth_hz : null);

  const spectralFlatness =
    getNum(spectralObj, "spectral_flatness") ??
    (isFiniteNumber((result as any).spectral_flatness) ? (result as any).spectral_flatness : null);

  // model_match (nuovo) fallback a reference_ai (vecchio)
  const modelMatchRatio = (() => {
    const mm = getObj(resultAny.model_match);
    const v1 = mm ? getNum(mm, "match_ratio") : null;
    if (v1 != null) return v1;

    const ra = getObj((result as any).reference_ai);
    const v2 = ra ? getNum(ra, "match_ratio") : null;
    return v2;
  })();

  const modelMatchPercent =
    modelMatchRatio == null ? null : clamp(modelMatchRatio <= 1 ? modelMatchRatio * 100 : modelMatchRatio, 0, 100);

  const effectiveBpm = isFiniteNumber((result as any).bpm) ? Math.round((result as any).bpm) : null;

  const analyzerKey =
    typeof (result as any).key === "string" && (result as any).key.trim().length > 0
      ? (result as any).key.trim()
      : null;

  const arraysBlobPathRaw = resultAny.arrays_blob_path;
  const arraysBlobPath =
    typeof arraysBlobPathRaw === "string" && arraysBlobPathRaw.trim().length > 0
      ? arraysBlobPathRaw.trim()
      : null;

  const arraysBlobSizeRaw = resultAny.arrays_blob_size_bytes;
  const arraysBlobSize = isFiniteNumber(arraysBlobSizeRaw) ? Math.round(arraysBlobSizeRaw) : null;

  const waveformPeaks =
    Array.isArray((result as any).waveform_peaks) && (result as any).waveform_peaks.length
      ? (result as any).waveform_peaks.filter((v: unknown): v is number => isFiniteNumber(v))
      : null;

  const waveformDuration =
    isFiniteNumber((result as any).waveform_duration) ? (result as any).waveform_duration : null;

  const waveformBands = (() => {
    const wb = getObj(resultAny.waveform_bands);
    return wb ? (wb as AnalyzerResult["waveform_bands"]) : null;
  })();

  // analysis_pro nel minimal analyzer non c’è (a meno che tu lo aggiunga), quindi qui spesso null
  const analysisPro = (() => {
    const ap = getObj(resultAny.analysis_pro);
    return ap ? ap : null;
  })();

  return {
    lufs: lufs ?? null,
    overall_score: isFiniteNumber((result as any).overall_score) ? (result as any).overall_score : null,
    feedback: (result as any).feedback ?? null,

    model_match_percent: modelMatchPercent,

    analyzer_json: result,

    // Salviamo sempre il blocco model_match nel campo coerente
    analyzer_reference_ai: resultAny.model_match ?? null,

    analysis_pro: analysisPro,

    analyzer_bpm: effectiveBpm,
    analyzer_spectral_centroid_hz: spectralCentroid,
    analyzer_spectral_rolloff_hz: spectralRolloff,
    analyzer_spectral_bandwidth_hz: spectralBandwidth,
    analyzer_spectral_flatness: spectralFlatness,
    analyzer_zero_crossing_rate: isFiniteNumber((result as any).zero_crossing_rate)
      ? (result as any).zero_crossing_rate
      : null,
    analyzer_key: analyzerKey,

    fix_suggestions: Array.isArray((result as any).fix_suggestions) ? (result as any).fix_suggestions : null,
    arrays_blob_path: arraysBlobPath,
    arrays_blob_size_bytes: arraysBlobSize,

    waveform_peaks: waveformPeaks,
    waveform_duration: waveformDuration,
    waveform_bands: waveformBands,

    analyzer_bands_norm: extractBandsNormFromAnalyzer(result),
  };
}
