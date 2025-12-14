import type { AnalyzerResult } from "@/types/analyzer";
import type { BandKey, BandsNorm } from "@/lib/reference/types";

type AnyRecord = Record<string, unknown>;

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const BAND_KEYS: BandKey[] = ["sub", "low", "lowmid", "mid", "presence", "high", "air"];

export function extractBandsNormFromAnalyzer(result: AnalyzerResult): BandsNorm {
  const spectralRaw = (result as unknown as AnyRecord)?.spectral as AnyRecord | undefined;
  if (!spectralRaw || typeof spectralRaw !== "object") {
    return {};
  }

  const bandNormRaw = spectralRaw.band_norm as AnyRecord | undefined;
  if (!bandNormRaw || typeof bandNormRaw !== "object") {
    return {};
  }

  const normalized: BandsNorm = {};
  for (const key of BAND_KEYS) {
    const value = bandNormRaw[key];
    if (isFiniteNumber(value)) {
      normalized[key] = value;
    }
  }
  return normalized;
}

/**
 * Mapping risultato Tekkin Analyzer -> colonne project_versions.
 */
export function buildAnalyzerUpdatePayload(result: AnalyzerResult) {
  // Fallback LUFS: preferisci result.lufs (già full-track Essentia),
  // altrimenti prova a leggere loudness_stats.integrated_lufs dal JSON.
  const integratedFromStats = (() => {
    const ls = (result as unknown as AnyRecord)?.loudness_stats as AnyRecord | undefined;
    const v = ls?.integrated_lufs;
    return isFiniteNumber(v) ? v : null;
  })();

  const lufs = isFiniteNumber(result.lufs) ? result.lufs : integratedFromStats;

  // model_match_percent: gestisce sia ratio 0..1 che percent 0..100
  const modelMatchPercent = (() => {
    const mr = (result.reference_ai as any)?.match_ratio;
    if (!isFiniteNumber(mr)) return null;

    // Se è un ratio (0..1) lo trasformo in percentuale.
    // Se è già percentuale (>1), lo tratto come percent.
    const percent = mr <= 1 ? mr * 100 : mr;
    return clamp(percent, 0, 100);
  })();

  const effectiveBpm = isFiniteNumber(result.bpm) ? Math.round(result.bpm) : null;

  const analyzerKey =
    typeof result.key === "string" && result.key.trim().length > 0
      ? result.key.trim()
      : null;

  const arraysBlobPathRaw = (result as unknown as AnyRecord)?.arrays_blob_path;
  const arraysBlobPath =
    typeof arraysBlobPathRaw === "string" && arraysBlobPathRaw.trim().length > 0
      ? arraysBlobPathRaw.trim()
      : null;

  const arraysBlobSizeRaw = (result as unknown as AnyRecord)?.arrays_blob_size_bytes;
  const arraysBlobSize = isFiniteNumber(arraysBlobSizeRaw) ? Math.round(arraysBlobSizeRaw) : null;

  const fixSuggestions =
    Array.isArray(result.fix_suggestions) ? result.fix_suggestions : null;

  // analysis_pro: lo salvo e ci inietto analysis_scope se disponibile nel result raw
  const analysisScope = (() => {
    const v = (result as unknown as AnyRecord)?.analysis_scope;
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  })();

  const analysisPro = (() => {
    const ap = (result as unknown as AnyRecord)?.analysis_pro;
    if (!ap || typeof ap !== "object") {
      return analysisScope ? { analysis_scope: analysisScope } : null;
    }
    // merge non distruttivo
    const merged = { ...(ap as AnyRecord) };
    if (analysisScope) merged.analysis_scope = analysisScope;
    return merged;
  })();

  const waveformPeaks =
    Array.isArray(result.waveform_peaks) && result.waveform_peaks.length
      ? result.waveform_peaks.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      : null;

  const waveformDuration =
    typeof result.waveform_duration === "number" && Number.isFinite(result.waveform_duration)
      ? result.waveform_duration
      : null;

  const waveformBands = (() => {
    const wb = (result as unknown as AnyRecord)?.waveform_bands;
    return wb && typeof wb === "object" ? (wb as AnalyzerResult["waveform_bands"]) : null;
  })();

  return {
    // metri principali
    lufs: lufs ?? null,
    overall_score: isFiniteNumber(result.overall_score) ? result.overall_score : null,
    feedback: result.feedback ?? null,

    // percentuale match con modello di genere
    model_match_percent: modelMatchPercent,

    // snapshot raw completo (debug / UI avanzata)
    analyzer_json: result,

    // reference ai
    analyzer_reference_ai: result.reference_ai ?? null,

    // analysis pro (jsonb)
    analysis_pro: analysisPro,

    // extra numerici
    analyzer_bpm: effectiveBpm,
    analyzer_spectral_centroid_hz: isFiniteNumber(result.spectral_centroid_hz)
      ? result.spectral_centroid_hz
      : null,
    analyzer_spectral_rolloff_hz: isFiniteNumber(result.spectral_rolloff_hz)
      ? result.spectral_rolloff_hz
      : null,
    analyzer_spectral_bandwidth_hz: isFiniteNumber(result.spectral_bandwidth_hz)
      ? result.spectral_bandwidth_hz
      : null,
    analyzer_spectral_flatness: isFiniteNumber(result.spectral_flatness)
      ? result.spectral_flatness
      : null,
    analyzer_zero_crossing_rate: isFiniteNumber(result.zero_crossing_rate)
      ? result.zero_crossing_rate
      : null,
    analyzer_key: analyzerKey,

    // fix suggestions
    fix_suggestions: fixSuggestions,
    arrays_blob_path: arraysBlobPath,
    arrays_blob_size_bytes: arraysBlobSize,
    waveform_peaks: waveformPeaks,
    waveform_duration: waveformDuration,
    waveform_bands: waveformBands,
    analyzer_bands_norm: extractBandsNormFromAnalyzer(result),
  };
}
