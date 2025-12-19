import type { AnalyzerCompareModel } from "@/components/analyzer-v2/types";

export function mapVersionToAnalyzerV2Model({
  version,
  project,
  arrays,
}: {
  version: any;
  project?: any;
  arrays?: any | null;
}): AnalyzerCompareModel {
  const aj = version.analyzer_json ?? {};

  return {
    projectTitle: project?.title ?? "Project",
    versionName: version.version_name ?? "Version",
    mixType: version.mix_type === "premaster" ? "PREMASTER" : "MASTER",

    bpm: version.analyzer_bpm ?? aj.bpm ?? null,
    key: version.analyzer_key ?? aj.key ?? null,
    overallScore: version.overall_score ?? null,

    bandsNorm: version.analyzer_bands_norm ?? null,

    spectral: aj.spectral ?? null,
    loudness: aj.loudness_stats ?? null,

    referenceName: null,
    referenceBandsNorm: null,

    // ADVANCED (solo se presenti)
    spectrumTrack: arrays?.analysis_pro?.spectral?.spectrum_track ?? null,
    spectrumRef: arrays?.analysis_pro?.spectral?.spectrum_ref ?? null,

    soundField: arrays?.analysis_pro?.stereo?.sound_field ?? null,

    levels: arrays?.analysis_pro?.levels ?? null,
  };
}
