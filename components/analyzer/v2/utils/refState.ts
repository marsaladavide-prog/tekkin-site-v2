import type { AnalyzerCompareModel } from "@/lib/analyzer/v2/types";
import { sumBands } from "./number";

export type RefState = { ref: boolean; live: boolean; mock: boolean; reason: string; rangeLabel?: string };

interface LiveStateOptions {
  hasLive: boolean;
  mockEnabled?: boolean;
  ref?: boolean;
  reason?: string;
}

export function getLiveStateForX(model: AnalyzerCompareModel, opts: LiveStateOptions): RefState {
  const { hasLive, mockEnabled, ref, reason } = opts;
  return {
    live: hasLive,
    mock: !!mockEnabled && !hasLive,
    ref: !!ref,
    reason:
      reason ??
      (hasLive
        ? "Dati live disponibili"
        : "Nessun dato live, mostro placeholder informativo"),
  };
}

function hasReferencePercentiles(model: AnalyzerCompareModel): boolean {
  const pct = model.referenceBandsPercentiles;
  if (!pct) return false;
  return Object.values(pct).some(
    (band) =>
      typeof band === "object" &&
      (typeof band.p10 === "number" ||
        typeof band.p25 === "number" ||
        typeof band.p75 === "number" ||
        typeof band.p90 === "number")
  );
}

export function getRefStateForTonal(model: AnalyzerCompareModel): RefState {
  const hasLive = !!model.bandsNorm && sumBands(model.bandsNorm) > 0;
  const hasRef = hasReferencePercentiles(model);
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
  const hasRef = !!(
    model.referenceFeaturesPercentiles &&
    model.referenceFeaturesPercentiles.lufs &&
    Object.keys(model.referenceFeaturesPercentiles.lufs).length > 0
  );
  const reason = hasRef
    ? "Target loudness dal reference"
    : model.referenceName
    ? "Reference senza target"
    : "Nessun reference loudness";
  return getLiveStateForX(model, { hasLive, ref: hasRef, reason });
}
