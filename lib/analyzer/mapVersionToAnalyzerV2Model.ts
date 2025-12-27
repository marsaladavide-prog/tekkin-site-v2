import type { AnalyzerCompareModel } from "@/lib/analyzer/v2/types";

function isRecord(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function mapVersionToAnalyzerV2Model({
  version,
  project,
  arrays,
}: {
  version: any;
  project?: any;
  arrays?: any | null;
}): AnalyzerCompareModel {
  const aj = isRecord(version?.analyzer_json) ? version.analyzer_json : {};
  const a = isRecord(arrays) ? arrays : {};

  // Arrays v3 (nuova shape): { loudness_stats, spectrum_db, sound_field, levels, transients, momentary_lufs, short_term_lufs }
  const loudnessFromArrays = isRecord(a.loudness_stats) ? a.loudness_stats : null;
  const loudnessFromAj = isRecord((aj as any).loudness_stats) ? (aj as any).loudness_stats : null;

  // Spectrum / sound field / levels
  const spectrumTrack = a.spectrum_db ?? null;
  const spectrumRef = a.spectrum_ref ?? null; // opzionale: se lo inietti lato backend con reference model

  const soundField = a.sound_field ?? null;
  const levels = a.levels ?? null;
  const transients = a.transients ?? null;

  const momentaryLufs = Array.isArray(a.momentary_lufs) ? a.momentary_lufs : null;
  const shortTermLufs = Array.isArray(a.short_term_lufs) ? a.short_term_lufs : null;

  // Tonal balance live: project_versions.analyzer_bands_norm (jsonb)
  const bandsNorm = isRecord(version?.analyzer_bands_norm) ? version.analyzer_bands_norm : null;
  const bandsNormKeys = bandsNorm ? Object.keys(bandsNorm) : [];
  const has_band_norm = bandsNormKeys.length > 0;

  // Spectral live: preferisci scalari su version, fallback su aj.spectral
  const spectralFromVersion = {
    spectral_centroid_hz: toNumber(version?.analyzer_spectral_centroid_hz),
    spectral_rolloff_hz: toNumber(version?.analyzer_spectral_rolloff_hz),
    spectral_bandwidth_hz: toNumber(version?.analyzer_spectral_bandwidth_hz),
    spectral_flatness: toNumber(version?.analyzer_spectral_flatness),
    zero_crossing_rate: toNumber(version?.analyzer_spectral_zcr),
  };
  const hasSpectralFromVersion = Object.values(spectralFromVersion).some((v) => typeof v === "number");

  const spectralFromAj = isRecord((aj as any).spectral) ? (aj as any).spectral : null;
  const spectral = hasSpectralFromVersion ? spectralFromVersion : spectralFromAj ?? null;

  return {
    projectTitle: project?.title ?? "Project",
    versionName: version?.version_name ?? "Version",

    bpm: version?.analyzer_bpm ?? (aj as any).bpm ?? null,
    key: version?.analyzer_key ?? (aj as any).key ?? null,

    // Quick facts
    spectral,

    // Tonal balance (track)
    bandsNormKeys,
    has_band_norm,
    bandsNorm,

    loudness: loudnessFromArrays ?? loudnessFromAj ?? null,

    momentaryLufs,
    shortTermLufs,

    referenceName: null,
    referenceBandsNorm: null,

    spectrumTrack,
    spectrumRef,

    soundField,
    levels,
    transients,

    // sections rimane nullable (se esiste)
    sections: Array.isArray((a as any).sections) ? (a as any).sections : null,
  } as any;
}
