export type ModelMatchMetrics = {
  bpm?: number | null;
  integrated_lufs?: number | null;
  stereo_width?: number | null;
  spectral_centroid_hz?: number | null;
  band_energy_norm?: Record<string, number> | null;
};

export type ModelMatchResult = {
  matchRatio: number;
  meanAbsError: number;
  deltas: Record<string, number>;
};

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getTargetFromPercentiles(obj: any, key: string): number | null {
  const node = obj?.[key];
  return toNumber(node?.p50);
}

function getTargetFromStats(obj: any, key: string): number | null {
  const node = obj?.[key];
  return toNumber(node?.mean);
}

function getModelTarget(model: any, key: string): number | null {
  const targets = model?.targets;
  if (targets && typeof targets === "object") {
    const direct = toNumber((targets as any)[key]);
    if (direct != null) return direct;
  }

  const featuresPercentiles = model?.features_percentiles;
  if (featuresPercentiles && typeof featuresPercentiles === "object") {
    const byKey = getTargetFromPercentiles(featuresPercentiles, key);
    if (byKey != null) return byKey;
    if (key === "integrated_lufs") {
      const lufs = getTargetFromPercentiles(featuresPercentiles, "lufs");
      if (lufs != null) return lufs;
    }
  }

  const loudnessPercentiles = model?.loudness_percentiles;
  if (loudnessPercentiles && typeof loudnessPercentiles === "object") {
    const loud = getTargetFromPercentiles(loudnessPercentiles, key);
    if (loud != null) return loud;
    if (key === "integrated_lufs") {
      const lufs = getTargetFromPercentiles(loudnessPercentiles, "integrated_lufs");
      if (lufs != null) return lufs;
    }
  }

  const spectralPercentiles = model?.spectral_percentiles;
  if (spectralPercentiles && typeof spectralPercentiles === "object") {
    const spec = getTargetFromPercentiles(spectralPercentiles, key);
    if (spec != null) return spec;
  }

  const rhythmPercentiles = model?.rhythm_percentiles;
  if (rhythmPercentiles && typeof rhythmPercentiles === "object" && key === "bpm") {
    const bpm = getTargetFromPercentiles(rhythmPercentiles, "bpm");
    if (bpm != null) return bpm;
  }

  const stereoPercentiles = model?.stereo_percentiles;
  if (stereoPercentiles && typeof stereoPercentiles === "object" && key === "stereo_width") {
    const width = getTargetFromPercentiles(stereoPercentiles, "stereo_width");
    if (width != null) return width;
  }

  const featuresStats = model?.features_stats;
  if (featuresStats && typeof featuresStats === "object") {
    const byKey = getTargetFromStats(featuresStats, key);
    if (byKey != null) return byKey;
    if (key === "integrated_lufs") {
      const lufs = getTargetFromStats(featuresStats, "lufs");
      if (lufs != null) return lufs;
    }
  }

  return null;
}

function getBandRefP50(model: any) {
  const out: Record<string, number> = {};
  const bnp = model?.bands_norm_percentiles;
  if (bnp && typeof bnp === "object") {
    for (const [key, obj] of Object.entries(bnp)) {
      const val = toNumber((obj as any)?.p50);
      if (val != null) out[key] = val;
    }
    if (Object.keys(out).length > 0) return out;
  }

  const bns = model?.bands_norm_stats;
  if (bns && typeof bns === "object") {
    for (const [key, obj] of Object.entries(bns)) {
      const val = toNumber((obj as any)?.mean);
      if (val != null) out[key] = val;
    }
  }

  return out;
}

export function computeModelMatch(
  metrics: ModelMatchMetrics,
  model: any
): ModelMatchResult | null {
  if (!model) return null;

  const picks: Array<[string, number]> = [];
  const pick = (key: string, value: number | null | undefined) => {
    const v = toNumber(value ?? null);
    const t = getModelTarget(model, key);
    if (v != null && t != null) {
      picks.push([key, v - t]);
    }
  };

  pick("bpm", metrics.bpm);
  pick("integrated_lufs", metrics.integrated_lufs);
  pick("stereo_width", metrics.stereo_width);
  pick("spectral_centroid_hz", metrics.spectral_centroid_hz);

  const bandsRef = getBandRefP50(model);
  const bandsCur = metrics.band_energy_norm;
  if (bandsCur && typeof bandsCur === "object") {
    for (const [key, target] of Object.entries(bandsRef)) {
      const v = toNumber((bandsCur as any)[key]);
      if (v != null && Number.isFinite(target)) {
        picks.push([`band_${key}`, v - target]);
      }
    }
  }

  if (picks.length === 0) return null;

  const absErr = picks.map(([, delta]) => Math.abs(delta));
  const meanAbsError = absErr.reduce((acc, v) => acc + v, 0) / absErr.length;
  const matchRatio = Math.max(0, Math.min(1, 1 / (1 + meanAbsError)));

  const deltas: Record<string, number> = {};
  for (const [key, delta] of picks) {
    deltas[key] = delta;
  }

  return {
    matchRatio,
    meanAbsError,
    deltas,
  };
}
