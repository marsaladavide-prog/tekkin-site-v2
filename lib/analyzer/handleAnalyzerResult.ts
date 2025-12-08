import type { AnalyzerResult } from "@/types/analyzer";

/**
 * Mapping risultato Tekkin Analyzer -> colonne project_versions.
 */
export function buildAnalyzerUpdatePayload(result: AnalyzerResult) {
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
    mix_v1,
    key,
  } = result;

    const modelMatchPercent =
    reference_ai?.model_match?.match_percent != null
      ? Number(reference_ai.model_match.match_percent)
      : reference_ai?.match_ratio != null
      ? Number(reference_ai.match_ratio * 100)
      : null;

  // BPM strutturale dal Tekkin Analyzer V1 (se presente)
  const structureBpm =
    mix_v1?.metrics?.structure?.bpm != null
      ? mix_v1.metrics.structure.bpm
      : null;

  // BPM "effettivo" unico
  let effectiveBpm: number | null = null;

  if (bpm != null && structureBpm != null) {
    const diff = Math.abs(bpm - structureBpm);

    if (diff > 1.5) {
      // Se sono troppo diversi, mi fido del BPM strutturale (V1)
      effectiveBpm = Math.round(structureBpm);
    } else {
      // Se sono vicini, media e arrotondo
      effectiveBpm = Math.round((bpm + structureBpm) / 2);
    }
  } else if (structureBpm != null) {
    effectiveBpm = Math.round(structureBpm);
  } else if (bpm != null) {
    effectiveBpm = Math.round(bpm);
  } else {
    effectiveBpm = null;
  }

  return {
    // metri "storici" sulle colonne principali
    lufs,
    sub_clarity: sub_clarity ?? null,
    hi_end: hi_end ?? null,
    dynamics: dynamics ?? null,
    stereo_image: stereo_image ?? null,
    tonality: tonality ?? null,
    overall_score,
    feedback,

    // nuovo: percentuale di match con il modello di genere
    model_match_percent: modelMatchPercent,

    // snapshot completo dell'Analyzer (utile per debug / UI avanzata)
    analyzer_json: result,

    // blocco Reference AI + Tekkin Analyzer V1
    analyzer_reference_ai: reference_ai ?? null,
    analyzer_mix_v1: mix_v1 ?? null,

    // extra numerici (BPM effettivo qui)
    analyzer_bpm: effectiveBpm,
    analyzer_spectral_centroid_hz: spectral_centroid_hz ?? null,
    analyzer_spectral_rolloff_hz: spectral_rolloff_hz ?? null,
    analyzer_spectral_bandwidth_hz: spectral_bandwidth_hz ?? null,
    analyzer_spectral_flatness: spectral_flatness ?? null,
    analyzer_zero_crossing_rate: zero_crossing_rate ?? null,
    analyzer_key: key ?? null,

    // suggerimenti di fix strutturati
    fix_suggestions: fix_suggestions ?? null,
  };
}

