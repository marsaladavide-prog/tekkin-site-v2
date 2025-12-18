import type { ProjectVersion } from "@/types/project";

export type AnalyzerReadyLevel = "none" | "quick" | "pro";

export type AnalyzerAvailability = {
  hasBase: boolean;
  hasArrays: boolean;
  hasBands: boolean;
  hasProfileKey: boolean;
  hasReference: boolean;
  readyLevel: AnalyzerReadyLevel;
};

export function getAnalyzerAvailability(
  version: ProjectVersion | null
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

  const hasBase =
    typeof version.lufs === "number" &&
    typeof version.bpm === "number" &&
    typeof version.overall_score === "number";

  const hasArrays =
    Array.isArray(version.analyzer_arrays?.momentary_lufs) &&
    version.analyzer_arrays.momentary_lufs.length > 0;

  const hasBands =
    typeof version.analyzer_bands_norm === "object" &&
    version.analyzer_bands_norm !== null;

  const hasProfileKey =
    typeof version.analyzer_profile_key === "string" &&
    version.analyzer_profile_key.length > 0;

  const hasReference =
    hasProfileKey && Boolean(version.reference_model_key);

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
