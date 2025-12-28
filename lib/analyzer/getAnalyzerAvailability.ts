export type AnalyzerReadyLevel = "none" | "quick" | "pro";

export type AnalyzerAvailability = {
  hasBase: boolean;
  hasArrays: boolean;
  hasBands: boolean;
  hasProfileKey: boolean;
  hasReference: boolean;
  readyLevel: AnalyzerReadyLevel;
};

export type ProjectVersionLike = {
  // DB fields reali
  lufs?: number | null;
  overall_score?: number | null;

  analyzer_bpm?: number | null;
  analyzer_key?: string | null;

  analyzer_arrays?: {
    momentary_lufs?: number[] | null;
  } | null;

  analyzer_bands_norm?: unknown | null;

  analyzer_profile_key?: string | null;
  reference_model_key?: string | null;
};

export function getAnalyzerAvailability(
  version: ProjectVersionLike | null
): AnalyzerAvailability {
  if (!version) {
    return {
      hasBase: false,
      hasArrays: false,
      hasBands: false,
      hasProfileKey: false,
      hasReference: false,
      readyLevel: "none",
    };
  }

  const hasLufs = typeof version.lufs === "number";
  const hasScore = typeof version.overall_score === "number";
  const hasBpm = typeof version.analyzer_bpm === "number";
  const hasKey =
    typeof version.analyzer_key === "string" &&
    version.analyzer_key.length > 0;

  const hasBase = hasLufs && hasScore && hasBpm && hasKey;

  const momentary = version.analyzer_arrays?.momentary_lufs;
  const hasArrays = Array.isArray(momentary) && momentary.length > 0;

  const hasBands = version.analyzer_bands_norm != null;

  const pk = version.analyzer_profile_key;
  const hasProfileKey = typeof pk === "string" && pk.length > 0;

  const hasReference = hasProfileKey && Boolean(version.reference_model_key);

  let readyLevel: AnalyzerReadyLevel = "none";
  if (hasBase) readyLevel = "quick";
  if (hasBase && (hasArrays || hasBands)) readyLevel = "pro";

  return {
    hasBase,
    hasArrays,
    hasBands,
    hasProfileKey,
    hasReference,
    readyLevel,
  };
}
