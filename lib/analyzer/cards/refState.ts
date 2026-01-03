import type { AnalyzerCompareModel, Bands, BandsPercentiles } from "@/lib/analyzer/v2/types";

const BAND_KEYS: Array<keyof Bands> = ["sub", "low", "lowmid", "mid", "presence", "high", "air"];

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sumBands(bands?: Bands | null): number {
  if (!bands) return 0;
  return BAND_KEYS.reduce((sum, key) => sum + safeNumber(bands[key]), 0);
}

export type RefState = {
  ref: boolean;
  live: boolean;
  mock: boolean;
  reason: string;
  rangeLabel?: string;
};

type LiveStateOptions = {
  hasLive: boolean;
  mockEnabled?: boolean;
  ref?: boolean;
  reason?: string;
  rangeLabel?: string;
};

export function getLiveStateForX(model: AnalyzerCompareModel, opts: LiveStateOptions): RefState {
  const { hasLive, mockEnabled, ref, reason, rangeLabel } = opts;
  return {
    live: hasLive,
    mock: !!mockEnabled && !hasLive,
    ref: !!ref,
    reason:
      reason ??
      (hasLive
        ? "Dati live disponibili"
        : "Nessun dato live, mostro placeholder informativo"),
    rangeLabel,
  };
}

function hasReferencePercentiles(percentiles?: BandsPercentiles | null): boolean {
  if (!percentiles) return false;
  return Object.values(percentiles).some((band) => {
    if (!band) return false;
    return (
      typeof band.p10 === "number" ||
      typeof band.p25 === "number" ||
      typeof band.p75 === "number" ||
      typeof band.p90 === "number"
    );
  });
}

export function getRefStateForTonal(model: AnalyzerCompareModel): RefState {
  const hasLive = !!model.bandsNorm && sumBands(model.bandsNorm) > 0;
  const hasRef = hasReferencePercentiles(model.referenceBandsPercentiles);
  const reason = hasRef
    ? "Percentili tonal balance disponibili"
    : model.referenceName
    ? "Reference selezionata ma percentili mancanti"
    : "Nessun reference per tonal balance";
  return getLiveStateForX(model, { hasLive, ref: hasRef, reason });
}

export function getRefStateForSpectrum(
  model: AnalyzerCompareModel,
  opts?: { mockEnabled?: boolean }
): RefState {
  const hasLive = Array.isArray(model.spectrumTrack) && model.spectrumTrack.length > 0;
  const hasRef = Array.isArray(model.spectrumRef) && model.spectrumRef.length > 0;
  const reason = hasRef
    ? "Spectrum reference disponibile"
    : model.referenceName
    ? "Reference spectrum mancante"
    : "Nessun reference spectrum";
  return getLiveStateForX(model, {
    hasLive,
    ref: hasRef,
    mockEnabled: opts?.mockEnabled,
    reason,
  });
}

export function getRefStateForLoudness(model: AnalyzerCompareModel): RefState {
  const hasLive =
    !!model.loudness &&
    typeof model.loudness.integrated_lufs === "number" &&
    Number.isFinite(model.loudness.integrated_lufs);
  const hasRef =
    !!model.referenceFeaturesPercentiles &&
    !!model.referenceFeaturesPercentiles.lufs &&
    Object.keys(model.referenceFeaturesPercentiles.lufs).length > 0;
  const reason = hasRef
    ? "Target loudness dal reference"
    : model.referenceName
    ? "Reference senza target"
    : "Nessun reference loudness";
  return getLiveStateForX(model, { hasLive, ref: hasRef, reason });
}

export function getRefStateForRhythm(model: AnalyzerCompareModel): RefState {
  const rhythm = model.rhythm ?? null;
  const hasLive =
    typeof model.bpm === "number" ||
    (typeof model.key === "string" && model.key.trim().length > 0) ||
    typeof rhythm?.danceability === "number" ||
    (Array.isArray(rhythm?.beat_times) && rhythm.beat_times.length > 0) ||
    (!!rhythm?.descriptors && Object.keys(rhythm.descriptors).length > 0);
  const hasRef =
    !!model.referenceRhythmPercentiles ||
    !!model.referenceRhythmDescriptorsPercentiles;
  const reason = hasRef
    ? "Reference rhythm disponibile"
    : model.referenceName
    ? "Reference rhythm mancante"
    : "Nessun reference rhythm";
  return getLiveStateForX(model, { hasLive, ref: hasRef, reason, rangeLabel: "p10/p90" });
}

export function getRefStateForStereo(model: AnalyzerCompareModel, hasLive?: boolean): RefState {
  const liveData = hasLive ?? !!(Array.isArray(model.soundFieldXY) && model.soundFieldXY.length > 0);
  const hasRef =
    !!(
      (model.referenceStereoPercentiles &&
        (model.referenceStereoPercentiles.stereoWidth ||
          model.referenceStereoPercentiles.lrCorrelation)) ||
      model.referenceSoundField ||
      model.referenceSoundFieldXY
    );
  const reason = hasRef
    ? "Stereo reference disponibile"
    : model.referenceName
    ? "Reference stereo mancante"
    : "Nessun reference stereo";
  return getLiveStateForX(model, {
    hasLive: liveData,
    ref: hasRef,
    mockEnabled: false,
    reason,
  });
}

export function getRefStateForTransients(model: AnalyzerCompareModel): RefState {
  const transients = model.transients ?? null;
  const hasLive =
    typeof transients?.strength === "number" ||
    typeof transients?.density === "number" ||
    typeof transients?.crestFactorDb === "number" ||
    typeof transients?.log_attack_time === "number";
  const hasRef = !!model.referenceTransientsPercentiles;
  const reason = hasRef
    ? "Reference transients disponibile"
    : model.referenceName
    ? "Reference transients mancante"
    : "Nessun reference transients";
  return getLiveStateForX(model, { hasLive, ref: hasRef, reason, rangeLabel: "p10/p90" });
}
