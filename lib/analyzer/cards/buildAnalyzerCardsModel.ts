import { mapVersionToAnalyzerCompareModel } from "@/lib/analyzer/v2/mapVersionToAnalyzerCompareModel";
import type { ReferenceModelLike, VersionRowLike } from "./types";
import type { AnalyzerCardsModel } from "./types";
import {
  getRefStateForLoudness,
  getRefStateForRhythm,
  getRefStateForSpectrum,
  getRefStateForStereo,
  getRefStateForTransients,
  getRefStateForTonal,
} from "./refState";

function normalizeProject(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function pickArrays(version: VersionRowLike) {
  return (
    version.analyzer_arrays ??
    (version as any).analyzer_arrays_blob ??
    (version as any).arrays_blob ??
    null
  );
}

function resolveLang(version: VersionRowLike) {
  const analyzerJson = version.analyzer_json;
  if (analyzerJson && typeof analyzerJson === "object" && "lang" in analyzerJson) {
    const lang = (analyzerJson as Record<string, unknown>).lang;
    if (lang === "en") return "en";
  }
  return "it";
}

function averageCorrelation(values?: number[] | null): number | null {
  if (!Array.isArray(values)) return null;
  const valid = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!valid.length) return null;
  const sum = valid.reduce((acc, curr) => acc + curr, 0);
  return sum / valid.length;
}

export function buildAnalyzerCardsModel(args: {
  version: VersionRowLike;
  referenceModel?: ReferenceModelLike | null;
  lang?: "it" | "en";
}): AnalyzerCardsModel {
  const { version, referenceModel = null } = args;
  const lang = args.lang ?? resolveLang(version);
  const arrays = pickArrays(version);
  const project = normalizeProject(version.project);
  const normalizedVersion = {
    ...version,
    analyzer_arrays: arrays,
    project,
  };

  const analyzerModel = mapVersionToAnalyzerCompareModel(normalizedVersion, referenceModel ?? undefined);

  const profileKey =
    version.analyzer_profile_key ??
    (version.reference_model_key as string | undefined) ??
    (referenceModel?.profile_key ?? null);

  const hasSoundFieldLive = Array.isArray(analyzerModel.soundFieldXY) && analyzerModel.soundFieldXY.length > 0;
  const refStates = {
    tonal: getRefStateForTonal(analyzerModel),
    spectrum: getRefStateForSpectrum(analyzerModel),
    loudness: getRefStateForLoudness(analyzerModel),
    rhythm: getRefStateForRhythm(analyzerModel),
    stereo: getRefStateForStereo(analyzerModel, hasSoundFieldLive),
    transients: getRefStateForTransients(analyzerModel),
  };

  const tonalComputed = {
    trackBands: analyzerModel.bandsNorm ?? null,
    referencePercentiles: analyzerModel.referenceBandsPercentiles ?? null,
    referenceName: analyzerModel.referenceName ?? null,
    lang,
  };

  const spectrumComputed = {
    track: analyzerModel.spectrumTrack ?? null,
    reference: analyzerModel.spectrumRef ?? null,
    spectral: analyzerModel.spectral ?? null,
    referenceSpectralPercentiles: analyzerModel.referenceSpectralPercentiles ?? null,
  };

  const stereoComputed = {
    width: analyzerModel.stereoWidth ?? null,
    widthPercentiles: analyzerModel.referenceStereoPercentiles?.stereoWidth ?? null,
    correlation: averageCorrelation(analyzerModel.correlation),
    correlationPercentiles: analyzerModel.referenceStereoPercentiles?.lrCorrelation ?? null,
    soundFieldXY: analyzerModel.soundFieldXY ?? null,
    referenceSoundFieldXY: analyzerModel.referenceSoundFieldXY ?? null,
    widthByBand: analyzerModel.widthByBand ?? null,
  };

  const transientsComputed = {
    transients: analyzerModel.transients ?? null,
    referencePercentiles: analyzerModel.referenceTransientsPercentiles ?? null,
    referenceName: analyzerModel.referenceName ?? null,
  };

  const extraComputed = {
    mfccMean: Array.isArray(analyzerModel.extra?.mfcc_mean) ? analyzerModel.extra?.mfcc_mean.slice(0, 13) : null,
    hfc: typeof analyzerModel.extra?.hfc === "number" ? analyzerModel.extra.hfc : null,
    spectralPeaksCount: typeof analyzerModel.extra?.spectral_peaks_count === "number" ? analyzerModel.extra.spectral_peaks_count : null,
    spectralPeaksEnergy: typeof analyzerModel.extra?.spectral_peaks_energy === "number" ? analyzerModel.extra.spectral_peaks_energy : null,
  };

  return {
    versionId: String(version.id),
    profileKey,
    lang,
    analyzer: analyzerModel,
    referenceModel,
    computed: {
      refStates,
      tonal: tonalComputed,
      spectrum: spectrumComputed,
      stereo: stereoComputed,
      transients: transientsComputed,
      extra: extraComputed,
    },
  };
}
