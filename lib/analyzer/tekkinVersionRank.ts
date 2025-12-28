import type {
  AnalyzerCompareModel,
  Bands,
  PercentileRange,
  ReferenceSpectralPercentiles,
  ReferenceTransientsPercentiles,
  ReferenceRhythmPercentiles,
} from "@/lib/analyzer/v2/types";
import { computeMixScores } from "@/lib/analyzer/computeMixScores";
import type {
  TekkinVersionRankComponent,
  TekkinVersionRankComponentKey,
  TekkinVersionRankDetails,
  TekkinVersionRankPenalty,
  TekkinVersionRankPrecision,
} from "@/lib/analyzer/tekkinRankTypes";
import type { BandsNorm } from "@/lib/reference/types";

const BAND_KEYS: Array<keyof Bands> = [
  "sub",
  "low",
  "lowmid",
  "mid",
  "presence",
  "high",
  "air",
];

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

interface RangeStats {
  mid: number;
  halfWidth: number;
}

function getRangeStats(range: PercentileRange | null | undefined): RangeStats | null {
  if (!range) return null;

  const low = range.p10 ?? range.p50 ?? range.p90 ?? null;
  const high = range.p90 ?? range.p50 ?? range.p10 ?? null;
  const mid = range.p50 ?? (low != null && high != null ? (low + high) / 2 : low ?? high ?? null);

  if (mid == null || Number.isNaN(mid)) return null;

  let width = 0;
  if (low != null && high != null) {
    width = Math.abs(high - low);
  }

  const fallback = Math.max(Math.abs(mid) * 0.15, 1);
  const halfWidth = width > 0 ? width / 2 : fallback;

  return {
    mid,
    halfWidth,
  };
}

type NormalizedOptions = { clamp: boolean };

function computeNormalizedDiff(
  valueIn: number | null | undefined,
  range: PercentileRange | null | undefined
): number | null;
function computeNormalizedDiff(
  valueIn: number | null | undefined,
  range: PercentileRange | null | undefined,
  options: NormalizedOptions
): number | null;
function computeNormalizedDiff(
  valueIn: number | null | undefined,
  range: PercentileRange | null | undefined,
  options: NormalizedOptions = { clamp: true }
): number | null {
  if (valueIn == null || !Number.isFinite(valueIn)) return null;
  const stats = getRangeStats(range);
  if (!stats) return null;
  const diff = Math.abs(valueIn - stats.mid);
  const raw = diff / stats.halfWidth;
  return options.clamp ? Math.min(raw, 1) : raw;
}

function getRangeBounds(range: PercentileRange | null | undefined) {
  if (!range) return { min: null, max: null };
  const min = range.p10 ?? range.p50 ?? range.p90 ?? null;
  const max = range.p90 ?? range.p50 ?? range.p10 ?? null;
  return { min, max };
}

function scoreAgainstRange(
  valueIn: number | null | undefined,
  range: PercentileRange | null | undefined
): number | null {
  if (valueIn == null || !Number.isFinite(valueIn) || !range) return null;
  const { min, max } = getRangeBounds(range);
  if (min != null && max != null) {
    const lower = Math.min(min, max);
    const upper = Math.max(min, max);
    if (valueIn >= lower && valueIn <= upper) {
      return 100;
    }
  }
  const normalized = computeNormalizedDiff(valueIn, range, { clamp: true });
  if (normalized == null) return null;
  const adjusted = 1 - Math.pow(normalized, 1.4);
  return clampNumber(adjusted * 100, 0, 100);
}

function scoreAgainstRangeSoft(
  valueIn: number | null | undefined,
  range: PercentileRange | null | undefined
): number | null {
  if (valueIn == null || !Number.isFinite(valueIn) || !range) return null;
  const { min, max } = getRangeBounds(range);
  if (min == null || max == null) return null;
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  if (valueIn >= lower && valueIn <= upper) {
    return 100;
  }
  const normalized = computeNormalizedDiff(valueIn, range, { clamp: false });
  if (normalized == null) return null;
  const outside = Math.max(0, normalized - 1);
  const soft = 85 - outside * 55;
  return clampNumber(soft, 0, 100);
}

function scoreInRangeOnly(
  valueIn: number | null | undefined,
  range: PercentileRange | null | undefined,
  toleranceRatio = 0
): number | null {
  if (valueIn == null || !Number.isFinite(valueIn) || !range) return null;
  const { min, max } = getRangeBounds(range);
  if (min == null || max == null) return null;
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  const width = Math.max(upper - lower, 0.0001);
  const tol = width * Math.max(0, toleranceRatio);
  return valueIn >= lower - tol && valueIn <= upper + tol ? 100 : 0;
}

function precisionCloseness(
  valueIn: number | null | undefined,
  range: PercentileRange | null | undefined
): number {
  if (valueIn == null || !Number.isFinite(valueIn) || !range) return 0;

  const stats = getRangeStats(range);
  if (!stats) return 0;

  const { min, max } = getRangeBounds(range);
  if (min == null || max == null) return 0;

  const lower = Math.min(min, max);
  const upper = Math.max(min, max);

  if (valueIn < lower || valueIn > upper) return 0;

  const mid = stats.mid;
  const denom =
    valueIn >= mid ? Math.max(upper - mid, 0.0001) : Math.max(mid - lower, 0.0001);
  const diff = Math.abs(valueIn - mid);
  const normalized = diff / denom;

  return Math.max(0, Math.min(1, 1 - normalized));
}

function averageScores(items: Array<number | null | undefined>): number | null {
  const nums = items.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (nums.length === 0) return null;
  const sum = nums.reduce((acc, value) => acc + value, 0);
  return sum / nums.length;
}

type PrecisionCheck = {
  value: number | null | undefined;
  range: PercentileRange | null | undefined;
};

function averagePrecision(checks: PrecisionCheck[]): number | null {
  const closeness = checks
    .map((entry) => {
      if (entry.value == null || !Number.isFinite(entry.value) || !entry.range) {
        return null;
      }
      return precisionCloseness(entry.value, entry.range);
    })
    .filter((value): value is number => value != null);

  if (closeness.length === 0) return null;
  const sum = closeness.reduce((acc, value) => acc + value, 0);
  return sum / closeness.length;
}

function buildReferenceSpectralScores(
  spectral: AnalyzerCompareModel["spectral"],
  reference: ReferenceSpectralPercentiles | null | undefined
): number | null {
  if (!reference || !spectral) return null;
  const checks: Array<number | null> = [
    scoreAgainstRangeSoft(spectral.spectral_centroid_hz ?? null, reference.spectral_centroid_hz ?? null),
    scoreAgainstRangeSoft(spectral.spectral_bandwidth_hz ?? null, reference.spectral_bandwidth_hz ?? null),
    scoreAgainstRangeSoft(spectral.spectral_rolloff_hz ?? null, reference.spectral_rolloff_hz ?? null),
    scoreAgainstRangeSoft(spectral.spectral_flatness ?? null, reference.spectral_flatness ?? null),
    scoreAgainstRangeSoft(spectral.zero_crossing_rate ?? null, reference.zero_crossing_rate ?? null),
  ];
  return averageScores(checks);
}

function buildReferenceTransientsScores(
  transients: AnalyzerCompareModel["transients"],
  reference: ReferenceTransientsPercentiles | null | undefined
): number | null {
  if (!reference || !transients) return null;
  const checks: Array<number | null> = [
    scoreAgainstRange(transients.strength ?? null, reference.strength ?? null),
    scoreAgainstRange(transients.density ?? null, reference.density ?? null),
    scoreAgainstRange(transients.crestFactorDb ?? null, reference.crest_factor_db ?? null),
    scoreAgainstRange(transients.log_attack_time ?? null, reference.log_attack_time ?? null),
  ];
  return averageScores(checks);
}

function buildReferenceRhythmScores(
  model: AnalyzerCompareModel,
  reference: ReferenceRhythmPercentiles | null | undefined
): number | null {
  if (!reference) return null;
  const checks: Array<number | null> = [
    scoreAgainstRange(model.bpm ?? null, reference.bpm ?? null),
    scoreAgainstRange(model.rhythm?.danceability ?? null, reference.danceability ?? null),
  ];
  return averageScores(checks);
}

function buildPrecisionDetails(model: AnalyzerCompareModel) {
  const tonalChecks: Array<PrecisionCheck> = BAND_KEYS.map((key) => ({
    value: model.bandsNorm?.[key] ?? null,
    range: model.referenceBandsPercentiles?.[key] ?? null,
  }));

  const loudnessChecks: Array<PrecisionCheck> = [
    { value: model.loudness?.integrated_lufs ?? null, range: model.referenceFeaturesPercentiles?.lufs ?? null },
    { value: model.loudness?.lra ?? null, range: model.referenceFeaturesPercentiles?.lra ?? null },
  ];

  const spectralChecks: Array<PrecisionCheck> = [
    { value: model.spectral?.spectral_centroid_hz ?? null, range: model.referenceSpectralPercentiles?.spectral_centroid_hz ?? null },
    { value: model.spectral?.spectral_bandwidth_hz ?? null, range: model.referenceSpectralPercentiles?.spectral_bandwidth_hz ?? null },
    { value: model.spectral?.spectral_rolloff_hz ?? null, range: model.referenceSpectralPercentiles?.spectral_rolloff_hz ?? null },
    { value: model.spectral?.spectral_flatness ?? null, range: model.referenceSpectralPercentiles?.spectral_flatness ?? null },
    { value: model.spectral?.zero_crossing_rate ?? null, range: model.referenceSpectralPercentiles?.zero_crossing_rate ?? null },
  ];

  const transientsChecks: Array<PrecisionCheck> = [
    { value: model.transients?.strength ?? null, range: model.referenceTransientsPercentiles?.strength ?? null },
    { value: model.transients?.density ?? null, range: model.referenceTransientsPercentiles?.density ?? null },
    { value: model.transients?.crestFactorDb ?? null, range: model.referenceTransientsPercentiles?.crest_factor_db ?? null },
    { value: model.transients?.log_attack_time ?? null, range: model.referenceTransientsPercentiles?.log_attack_time ?? null },
  ];

  const rhythmChecks: Array<PrecisionCheck> = [
    { value: model.bpm ?? null, range: model.referenceRhythmPercentiles?.bpm ?? null },
    { value: model.rhythm?.danceability ?? null, range: model.referenceRhythmPercentiles?.danceability ?? null },
  ];

  const tonalPrecision = averagePrecision(tonalChecks);
  const loudnessPrecision = averagePrecision(loudnessChecks);
  const spectralPrecision = averagePrecision(spectralChecks);
  const transientsPrecision = averagePrecision(transientsChecks);
  const rhythmPrecision = averagePrecision(rhythmChecks);

  const precisionEntries: Array<{
    key: TekkinVersionRankComponentKey;
    label: string;
    weight: number;
    closeness: number | null;
  }> = [
    { key: "tonal", label: "Tonal balance", weight: 0.35, closeness: tonalPrecision },
    { key: "loudness", label: "Loudness", weight: 0.25, closeness: loudnessPrecision },
    { key: "spectral", label: "Spettro", weight: 0.15, closeness: spectralPrecision },
    { key: "transients", label: "Transients", weight: 0.15, closeness: transientsPrecision },
    { key: "rhythm", label: "Rhythm", weight: 0.1, closeness: rhythmPrecision },
  ];

  const totalWeight = precisionEntries.reduce((acc, entry) => acc + entry.weight, 0);
  const closenessSum = precisionEntries.reduce((acc, entry) => acc + (entry.closeness ?? 0) * entry.weight, 0);
  const closenessFactor = totalWeight > 0 ? closenessSum / totalWeight : 0;
  const bonus = Math.min(3, closenessFactor * 3);

  const breakdown: TekkinVersionRankPrecision[] = precisionEntries.map((entry) => ({
    key: entry.key,
    label: entry.label,
    closeness: entry.closeness,
  }));

  return {
    bonus,
    breakdown,
  };
}

function buildReferenceTonalScore(
  model: AnalyzerCompareModel
): number | null {
  const scores: number[] = [];
  if (!model.referenceBandsPercentiles) return null;

  for (const key of BAND_KEYS) {
    const pct = model.referenceBandsPercentiles[key];
    const value = model.bandsNorm?.[key];
    const score = scoreAgainstRange(value ?? null, pct ?? null);
    if (score != null) {
      scores.push(score);
    }
  }

  return averageScores(scores);
}

function buildReferenceLoudnessScore(
  loudness: AnalyzerCompareModel["loudness"],
  reference: AnalyzerCompareModel["referenceFeaturesPercentiles"]
): number | null {
  if (!reference || !loudness) return null;
  const checks: Array<number | null> = [
    scoreInRangeOnly(loudness.integrated_lufs ?? null, reference.lufs ?? null, 0.05),
    scoreInRangeOnly(loudness.lra ?? null, reference.lra ?? null, 0.05),
  ];
  return averageScores(checks);
}

function formatLufs(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)} LUFS`;
}

function formatLu(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)} LU`;
}

function formatRangeDesc(range: PercentileRange | null | undefined) {
  if (!range) return "n/a";
  const low = typeof range.p10 === "number" ? range.p10.toFixed(1) : "n/a";
  const high = typeof range.p90 === "number" ? range.p90.toFixed(1) : "n/a";
  if (low === "n/a" && high === "n/a") return "n/a";
  return `${low} / ${high}`;
}

function describeRangeStatus(
  label: string,
  value: number | null | undefined,
  range: PercentileRange | null | undefined,
  formatter: (value: number | null | undefined) => string,
  toleranceRatio = 0
) {
  if (value == null || !Number.isFinite(value) || !range) {
    return `${label}: n/a`;
  }
  const { min, max } = getRangeBounds(range);
  if (min == null || max == null) {
    return `${label}: n/a`;
  }
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  const width = Math.max(upper - lower, 0.0001);
  const tol = width * Math.max(0, toleranceRatio);
  if (value >= lower - tol && value <= upper + tol) {
    return `${label}: ok (${formatter(value)} in ${formatRangeDesc(range)})`;
  }
  const side = value < lower ? "sotto" : "sopra";
  const delta = value < lower ? lower - value : value - upper;
  return `${label}: ${side} di ${delta.toFixed(2)} (${formatter(value)} vs ${formatRangeDesc(range)})`;
}

function buildQualityPenaltyDetails(model: AnalyzerCompareModel) {
  const entries: TekkinVersionRankPenalty[] = [];
  let total = 0;

  const loudnessRange = model.referenceFeaturesPercentiles?.lufs ?? null;
  const integrated = model.loudness?.integrated_lufs ?? null;
  if (loudnessRange) {
    const normalized = computeNormalizedDiff(integrated, loudnessRange, { clamp: false });
    const deadZone = 0.1;
    if (normalized != null && normalized > 1 + deadZone) {
      const amount = Math.min(0.25, (normalized - (1 + deadZone)) * 0.18);
      if (amount > 0) {
        entries.push({
          key: "loudness_range",
          label: "LUFS fuori target",
          amount,
          points: amount * 100,
          details: `Integrated ${formatLufs(integrated)} vs target ${formatRangeDesc(loudnessRange)}`,
        });
        total += amount;
      }
    }
  }

  return { total: Math.min(0.45, total), entries };
}

function buildReferenceFitBreakdown(model: AnalyzerCompareModel) {
  const tonalScore = buildReferenceTonalScore(model);
  const loudnessScore = buildReferenceLoudnessScore(model.loudness, model.referenceFeaturesPercentiles);
  const spectralScore = buildReferenceSpectralScores(model.spectral, model.referenceSpectralPercentiles);
  const transientsScore = buildReferenceTransientsScores(model.transients, model.referenceTransientsPercentiles);
  const rhythmScore = buildReferenceRhythmScores(model, model.referenceRhythmPercentiles);
  const loudnessDetailLines = model.referenceFeaturesPercentiles
    ? [
        describeRangeStatus(
          "LUFS",
          model.loudness?.integrated_lufs ?? null,
          model.referenceFeaturesPercentiles.lufs ?? null,
          formatLufs,
          0.05
        ),
        describeRangeStatus(
          "LRA",
          model.loudness?.lra ?? null,
          model.referenceFeaturesPercentiles.lra ?? null,
          formatLu,
          0.05
        ),
      ]
    : [];

  const definitions: Array<{
    key: TekkinVersionRankComponent["key"];
    label: string;
    description: string;
    weight: number;
    score: number | null;
    detailLines?: string[];
  }> = [
    {
      key: "tonal",
      label: "Tonal balance",
      description: "Sub, bassi, mid, presence, alti e air vs percentili reference.",
      weight: 0.35,
      score: tonalScore,
    },
    {
      key: "loudness",
      label: "Loudness",
      description: "Integrated LUFS e LRA vs target.",
      weight: 0.25,
      score: loudnessScore,
      detailLines: loudnessDetailLines.length ? loudnessDetailLines : undefined,
    },
    {
      key: "spectral",
      label: "Spettro",
      description: "Centroid, bandwidth, rolloff, flatness e ZCR vs reference.",
      weight: 0.15,
      score: spectralScore,
    },
    {
      key: "transients",
      label: "Transients",
      description: "Strength, density, crest e attack vs reference.",
      weight: 0.15,
      score: transientsScore,
    },
    {
      key: "rhythm",
      label: "Rhythm",
      description: "BPM e danceability confrontati al reference.",
      weight: 0.1,
      score: rhythmScore,
    },
  ];

  const valid = definitions.filter((entry) => entry.score != null && Number.isFinite(entry.score));
  const totalWeight = valid.reduce((acc, entry) => acc + entry.weight, 0);
  const weightedSum = valid.reduce((acc, entry) => acc + (entry.score ?? 0) * entry.weight, 0);

  const referenceFit = valid.length && totalWeight > 0 ? weightedSum / totalWeight : null;

  const components: TekkinVersionRankComponent[] = definitions.map((entry) => ({
    key: entry.key,
    label: entry.label,
    description: entry.description,
    weight: entry.weight,
    score: entry.score,
    hasData: entry.score != null,
    contribution:
      entry.score != null && totalWeight > 0 ? (entry.score * entry.weight) / totalWeight : null,
    detailLines: entry.detailLines,
  }));

  return {
    referenceFit,
    components,
  };
}

export function calculateTekkinVersionRankFromModel(model: AnalyzerCompareModel): TekkinVersionRankDetails {
  const { referenceFit, components } = buildReferenceFitBreakdown(model);
  const precisionDetails = buildPrecisionDetails(model);
  const mixScores = computeMixScores({
    lufs: model.loudness?.integrated_lufs ?? null,
    lra: model.loudness?.lra ?? null,
    samplePeakDb: model.loudness?.sample_peak_db ?? null,
    spectralCentroidHz: model.spectral?.spectral_centroid_hz ?? null,
    spectralRolloffHz: model.spectral?.spectral_rolloff_hz ?? null,
    spectralBandwidthHz: model.spectral?.spectral_bandwidth_hz ?? null,
    spectralFlatness: model.spectral?.spectral_flatness ?? null,
    zeroCrossingRate: model.spectral?.zero_crossing_rate ?? null,
    stereoWidth: model.stereoWidth ?? null,
    bandsNorm: (model.bandsNorm ?? {}) as BandsNorm,
    modelMatchPercent: null,
  });

  const baseQuality =
    typeof mixScores.overall_score === "number" && Number.isFinite(mixScores.overall_score)
      ? clampNumber(mixScores.overall_score, 0, 100)
      : null;

  let candidate: number;
  if (referenceFit != null) {
    candidate = referenceFit;
  } else if (baseQuality != null) {
    candidate = baseQuality;
  } else {
    candidate = 50;
  }

  candidate += precisionDetails.bonus;
  const penaltyDetails = buildQualityPenaltyDetails(model);
  const prePenaltyScore = clampNumber(candidate, 1, 100);
  const finalScore = clampNumber(candidate - penaltyDetails.total * 100, 1, 100);
  return {
    score: Math.round(finalScore),
    referenceFit,
    baseQuality,
    prePenaltyScore,
    components,
    penalties: penaltyDetails.entries,
    precisionBonus: precisionDetails.bonus,
    precisionBreakdown: precisionDetails.breakdown,
  };
}
