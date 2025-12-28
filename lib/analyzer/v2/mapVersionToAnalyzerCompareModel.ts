import type {
  AnalyzerCompareModel,
  Bands,
  BandsPercentiles,
  LevelMeter,
  SpectrumPoint,
  Spectral,
  Loudness,
  ReferenceStereoPercentiles,
  PercentileRange,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pick(obj: unknown, paths: string[]): unknown {
  for (const p of paths) {
    let v: unknown = obj;
    for (const k of p.split(".")) {
      if (!isRecord(v)) {
        v = null;
        break;
      }
      v = v[k];
    }
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

function pickNum(obj: unknown, paths: string[]) {
  const v = pick(obj, paths);
  return isNumber(v) ? v : null;
}

function pickStr(obj: unknown, paths: string[]) {
  const v = pick(obj, paths);
  return isString(v) ? v : null;
}

const BAND_KEYS: Array<keyof Bands> = ["sub", "low", "lowmid", "mid", "presence", "high", "air"];

function sanitizeBands(value: unknown): Bands | null {
  if (!isRecord(value)) return null;
  const out: Bands = {};
  let has = false;
  for (const key of BAND_KEYS) {
    const candidate = value[key];
    if (isNumber(candidate)) {
      out[key] = candidate;
      has = true;
    }
  }
  return has ? out : null;
}

function extractBandsPercentiles(reference: unknown): BandsPercentiles | null {
  const percentiles = isRecord(reference) ? reference.bands_norm_percentiles : null;
  if (!isRecord(percentiles)) return null;
  const out: BandsPercentiles = {};
  let has = false;
  for (const key of BAND_KEYS) {
    const bandPerc = percentiles[key];
    if (isRecord(bandPerc)) {
      const p: Record<string, number> = {};
      if (isNumber(bandPerc.p10)) p.p10 = bandPerc.p10;
      if (isNumber(bandPerc.p25)) p.p25 = bandPerc.p25;
      if (isNumber(bandPerc.p50)) p.p50 = bandPerc.p50;
      if (isNumber(bandPerc.p75)) p.p75 = bandPerc.p75;
      if (isNumber(bandPerc.p90)) p.p90 = bandPerc.p90;
      if (Object.keys(p).length > 0) {
        out[key] = p;
        has = true;
      }
    }
  }
  return has ? out : null;
}

// new helper (sanitizes band-percentile objects)
function sanitizeBandsPercentiles(value: unknown): BandsPercentiles | null {
  if (!isRecord(value)) return null;
  const out: BandsPercentiles = {};
  let has = false;
  for (const key of BAND_KEYS) {
    const bandPerc = value[key];
    if (isRecord(bandPerc)) {
      const p: Record<string, number> = {};
      if (isNumber(bandPerc.p10)) p.p10 = bandPerc.p10;
      if (isNumber(bandPerc.p25)) p.p25 = bandPerc.p25;
      if (isNumber(bandPerc.p50)) p.p50 = bandPerc.p50;
      if (isNumber(bandPerc.p75)) p.p75 = bandPerc.p75;
      if (isNumber(bandPerc.p90)) p.p90 = bandPerc.p90;
      if (Object.keys(p).length > 0) {
        out[key] = p;
        has = true;
      }
    }
  }
  return has ? out : null;
}

function buildPercentileRange(value: unknown): PercentileRange | null {
  if (!isRecord(value)) return null;
  const out: PercentileRange = {};
  if (isNumber(value.p10)) out.p10 = value.p10;
  if (isNumber(value.p50)) out.p50 = value.p50;
  if (isNumber(value.p90)) out.p90 = value.p90;
  return Object.keys(out).length ? out : null;
}

function extractStereoPercentiles(reference: unknown): ReferenceStereoPercentiles | null {
  const stereo = isRecord(reference) ? reference.stereo_percentiles : null;
  if (!isRecord(stereo)) return null;

  const lrBalance = buildPercentileRange(stereo.lr_balance_db);
  const lrCorrelation = buildPercentileRange(stereo.lr_correlation);

  const stereoWidth = buildPercentileRange(stereo.stereo_width);

  const widthByBand = isRecord(stereo.width_by_band_percentiles)
    ? sanitizeBandsPercentiles(stereo.width_by_band_percentiles)
    : null;

  const out: ReferenceStereoPercentiles = {};
  if (lrBalance) out.lrBalanceDb = lrBalance;
  if (lrCorrelation) out.lrCorrelation = lrCorrelation;
  if (stereoWidth) out.stereoWidth = stereoWidth;
  if (widthByBand) out.widthByBand = widthByBand;

  return Object.keys(out).length ? out : null;
}

function extractTransientsPercentiles(reference: unknown) {
  const record = isRecord(reference) ? reference : null;
  const transients = record?.transients_percentiles ?? record?.transientsPercentiles;
  if (!isRecord(transients)) return null;

  const crest = buildPercentileRange(transients.crest_factor_db ?? transients.crestFactorDb);
  const strength = buildPercentileRange(transients.strength);
  const density = buildPercentileRange(transients.density);
  const logAttack = buildPercentileRange(transients.log_attack_time ?? transients.logAttackTime);

  const out: Record<string, PercentileRange> = {};
  if (crest) out.crest_factor_db = crest;
  if (strength) out.strength = strength;
  if (density) out.density = density;
  if (logAttack) out.log_attack_time = logAttack;
  return Object.keys(out).length ? out : null;
}

function extractRhythmPercentiles(reference: unknown) {
  const record = isRecord(reference) ? reference : null;
  const rhythm = record?.rhythm_percentiles ?? record?.rhythmPercentiles;
  if (!isRecord(rhythm)) return null;

  const bpm = buildPercentileRange(rhythm.bpm);
  const stability = buildPercentileRange(rhythm.stability);
  const danceability = buildPercentileRange(rhythm.danceability);

  const out: Record<string, PercentileRange> = {};
  if (bpm) out.bpm = bpm;
  if (stability) out.stability = stability;
  if (danceability) out.danceability = danceability;
  return Object.keys(out).length ? out : null;
}

function extractRhythmDescriptorsPercentiles(reference: unknown) {
  const record = isRecord(reference) ? reference : null;
  const descriptors =
    record?.rhythm_descriptors_percentiles ?? record?.rhythmDescriptorsPercentiles;
  if (!isRecord(descriptors)) return null;

  const ibiMean = buildPercentileRange(descriptors.ibi_mean ?? descriptors.ibiMean);
  const ibiStd = buildPercentileRange(descriptors.ibi_std ?? descriptors.ibiStd);
  const beatsCount = buildPercentileRange(descriptors.beats_count ?? descriptors.beatsCount);
  const keyStrength = buildPercentileRange(descriptors.key_strength ?? descriptors.keyStrength);

  const out: Record<string, PercentileRange> = {};
  if (ibiMean) out.ibi_mean = ibiMean;
  if (ibiStd) out.ibi_std = ibiStd;
  if (beatsCount) out.beats_count = beatsCount;
  if (keyStrength) out.key_strength = keyStrength;
  return Object.keys(out).length ? out : null;
}

function extractSpectralPercentiles(reference: unknown) {
  const record = isRecord(reference) ? reference : null;
  const spectral = record?.spectral_percentiles ?? record?.spectralPercentiles;
  if (!isRecord(spectral)) return null;

  const centroid = buildPercentileRange(spectral.spectral_centroid_hz ?? spectral.spectralCentroidHz);
  const bandwidth = buildPercentileRange(spectral.spectral_bandwidth_hz ?? spectral.spectralBandwidthHz);
  const rolloff = buildPercentileRange(spectral.spectral_rolloff_hz ?? spectral.spectralRolloffHz);
  const flatness = buildPercentileRange(spectral.spectral_flatness ?? spectral.spectralFlatness);
  const zcr = buildPercentileRange(spectral.zero_crossing_rate ?? spectral.zeroCrossingRate);

  const out: Record<string, PercentileRange> = {};
  if (centroid) out.spectral_centroid_hz = centroid;
  if (bandwidth) out.spectral_bandwidth_hz = bandwidth;
  if (rolloff) out.spectral_rolloff_hz = rolloff;
  if (flatness) out.spectral_flatness = flatness;
  if (zcr) out.zero_crossing_rate = zcr;
  return Object.keys(out).length ? out : null;
}

function extractSoundFieldRef(reference: unknown) {
  const record = isRecord(reference) ? reference : null;
  const sf = record?.sound_field_ref ?? record?.soundFieldRef;
  if (!isRecord(sf)) return null;

  const angleDeg = Array.isArray(sf.angle_deg) ? sf.angle_deg.filter(isNumber) : null;
  const p10 = Array.isArray(sf.p10_radius) ? sf.p10_radius.filter((v) => isNumber(v) || v == null) : null;
  const p50 = Array.isArray(sf.p50_radius) ? sf.p50_radius.filter((v) => isNumber(v) || v == null) : null;
  const p90 = Array.isArray(sf.p90_radius) ? sf.p90_radius.filter((v) => isNumber(v) || v == null) : null;

  const out: Record<string, number[] | number | null> = {};
  if (angleDeg?.length) out.angle_deg = angleDeg;
  if (p10?.length) out.p10_radius = p10;
  if (p50?.length) out.p50_radius = p50;
  if (p90?.length) out.p90_radius = p90;
  if (isNumber(sf.bin_step_deg)) out.bin_step_deg = sf.bin_step_deg;
  if (isNumber(sf.deg_max)) out.deg_max = sf.deg_max;
  return Object.keys(out).length ? out : null;
}

function extractSoundFieldXYRef(reference: unknown) {
  const record = isRecord(reference) ? reference : null;
  const sf = record?.sound_field_xy_ref ?? record?.soundFieldXYRef;
  if (!Array.isArray(sf)) return null;
  const out: { x: number; y: number }[] = [];
  for (const p of sf) {
    if (!isRecord(p)) continue;
    const x = p.x;
    const y = p.y;
    if (isNumber(x) && isNumber(y)) {
      out.push({ x, y });
    }
  }
  return out.length ? out : null;
}

function extractSpectrumRef(referenceModel: unknown): SpectrumPoint[] | null {
  // supporto sia schema nuovo (spectrum_db) che schema vecchio/attuale (spectrum_ref)
  const src =
    (isRecord(referenceModel) && isRecord(referenceModel.spectrum_db)
      ? referenceModel.spectrum_db
      : null) ??
    (isRecord(referenceModel) && isRecord(referenceModel.spectrum_ref)
      ? referenceModel.spectrum_ref
      : null);

  const hz = isRecord(src) ? src.hz : null;
  const refDb = isRecord(src) ? src.ref_db ?? src.mean_db ?? src.db ?? null : null;

  if (!Array.isArray(hz) || !Array.isArray(refDb)) return null;

  const n = Math.min(hz.length, refDb.length);
  const out: SpectrumPoint[] = [];

  for (let i = 0; i < n; i += 1) {
    const h = hz[i];
    const d = refDb[i];
    if (!isNumber(h)) continue;
    if (!isNumber(d)) continue;
    out.push({ hz: h, mag: d });
  }

  return out.length ? out : null;
}


function toSpectrumPoints(hzArr: unknown, dbArr: unknown): SpectrumPoint[] {
  const hz = Array.isArray(hzArr) ? hzArr : [];
  const db = Array.isArray(dbArr) ? dbArr : [];
  const pts: SpectrumPoint[] = [];

  for (let i = 0; i < Math.min(hz.length, db.length); i++) {
    const h = hz[i];
    const d = db[i];
    if (isNumber(h) && isNumber(d)) {
      pts.push({ hz: h, mag: d });
    }
  }

  return pts;
}

function pickSpectrumDb(obj: unknown): { hz: unknown; db: unknown } | null {
  const s = isRecord(obj) ? obj.spectrum_db ?? obj.spectrumDb ?? null : null;
  if (!isRecord(s)) return null;

  // reference models: { hz: [], ref_db: [] }
  if (Array.isArray(s.hz) && Array.isArray(s.ref_db)) return { hz: s.hz, db: s.ref_db };

  // arrays.json: { hz: [], track_db: [] }
  if (Array.isArray(s.hz) && Array.isArray(s.track_db)) return { hz: s.hz, db: s.track_db };

  return null;
}

function _safeJsonParse(v: string) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function resampleSpectrumLinear(hzTarget: number[], hzRef: number[], dbRef: number[]) {
  if (!hzTarget.length || hzRef.length < 2 || dbRef.length < 2) return [];
  const out: number[] = [];
  let j = 0;

  for (const x of hzTarget) {
    while (j < hzRef.length - 2 && hzRef[j + 1] < x) j++;

    const x0 = hzRef[j];
    const x1 = hzRef[j + 1];
    const y0 = dbRef[j];
    const y1 = dbRef[j + 1];

    if (!Number.isFinite(x0) || !Number.isFinite(x1) || !Number.isFinite(y0) || !Number.isFinite(y1) || x1 === x0) {
      out.push(y0);
      continue;
    }

    const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
    out.push(lerp(y0, y1, t));
  }

  return out;
}

function pickPercentiles3(obj: unknown): { p10?: number; p50?: number; p90?: number } | null {
  if (!isRecord(obj)) return null;
  const p10 = isNumber(obj.p10) ? obj.p10 : null;
  const p50 = isNumber(obj.p50) ? obj.p50 : null;
  const p90 = isNumber(obj.p90) ? obj.p90 : null;
  if (p10 == null && p50 == null && p90 == null) return null;
  const out: Record<string, number> = {};
  if (p10 != null) out.p10 = p10;
  if (p50 != null) out.p50 = p50;
  if (p90 != null) out.p90 = p90;
  return out;
}

function ensureNumArr(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isNumber);
}

const LEVEL_LABELS = new Set<LevelMeter["label"]>(["L", "C", "R", "Ls", "Rs", "LFE"]);

function isLevelLabel(v: unknown): v is LevelMeter["label"] {
  return typeof v === "string" && LEVEL_LABELS.has(v as LevelMeter["label"]);
}

export function mapVersionToAnalyzerCompareModel(version: unknown, referenceModel?: unknown): AnalyzerCompareModel {
  const versionRecord: Record<string, unknown> = isRecord(version)
    ? version
    : ({} as Record<string, unknown>);
  const analyzer: Record<string, unknown> | null =
    isRecord(versionRecord.analyzer_json)
      ? (versionRecord.analyzer_json as Record<string, unknown>)
      : null;
  const arrays: Record<string, unknown> | null =
    isRecord(pick(versionRecord, ["analyzer_arrays"]))
      ? (pick(versionRecord, ["analyzer_arrays"]) as Record<string, unknown>)
      : null;

  const trackBandsCandidate =
    versionRecord.analyzer_bands_norm ??
    pick(analyzer, [
      "bands_norm",
      "band_energy_norm",
      "spectral.band_norm",
      "band_norm",
    ]) ??
    null;

  const referenceBandsCandidate =
    versionRecord.reference_bands_norm ??
    analyzer?.reference_bands_norm ??
    (isRecord(analyzer?.reference) ? analyzer.reference.bands_norm : null) ??
    null;

  const momentaryLufs = ensureNumArr(pick(arrays, ["loudness_stats.momentary_lufs"]));
  const shortTermLufs = ensureNumArr(pick(arrays, ["loudness_stats.short_term_lufs"]));

  const bandsNorm = sanitizeBands(trackBandsCandidate);
  const referenceBandsNorm = sanitizeBands(referenceBandsCandidate);
  const referenceBandsPercentiles = extractBandsPercentiles(referenceModel);
  const referenceLoudnessPercentiles = buildPercentileRange(
    pick(referenceModel, ["features_percentiles.lufs", "loudness_percentiles.integrated_lufs"])
  );
  const referenceLraPercentiles = buildPercentileRange(
    pick(referenceModel, ["features_percentiles.lra", "loudness_percentiles.lra"])
  );
  const referenceSamplePeakPercentiles = buildPercentileRange(
    pick(referenceModel, ["features_percentiles.sample_peak_db", "loudness_percentiles.sample_peak_db"])
  );
  const referenceTruePeakPercentiles = buildPercentileRange(
    pick(referenceModel, ["features_percentiles.true_peak_db", "loudness_percentiles.true_peak_db"])
  );
  const referenceFeaturesPercentiles =
    referenceLoudnessPercentiles || referenceLraPercentiles || referenceSamplePeakPercentiles || referenceTruePeakPercentiles
      ? {
          lufs: referenceLoudnessPercentiles,
          lra: referenceLraPercentiles,
          sample_peak_db: referenceSamplePeakPercentiles,
          true_peak_db: referenceTruePeakPercentiles,
        }
      : null;

  const referenceBandsFromModel = sanitizeBands(pick(referenceModel, ["bands_norm"]));
  const referenceBandsNormFinal = referenceBandsNorm ?? referenceBandsFromModel;

const spectralSrc =
  pick(arrays, ["spectral"]) ??
  pick(analyzer, ["spectral"]);

const spectralFromVersion = {
  spectral_centroid_hz: pickNum(version, ["analyzer_spectral_centroid_hz"]) ?? null,
  spectral_rolloff_hz: pickNum(version, ["analyzer_spectral_rolloff_hz"]) ?? null,
  spectral_bandwidth_hz: pickNum(version, ["analyzer_spectral_bandwidth_hz"]) ?? null,
  spectral_flatness: pickNum(version, ["analyzer_spectral_flatness"]) ?? null,
  zero_crossing_rate:
    pickNum(version, ["analyzer_zero_crossing_rate", "analyzer_spectral_zcr"]) ?? null,
};

const spectral: Spectral = {
  spectral_flatness:
    pickNum(spectralSrc, ["spectral_flatness", "flatness"]) ??
    spectralFromVersion.spectral_flatness ??
    null,
  zero_crossing_rate:
    pickNum(spectralSrc, ["zero_crossing_rate", "zcr"]) ??
    spectralFromVersion.zero_crossing_rate ??
    null,
  spectral_rolloff_hz:
    pickNum(spectralSrc, ["spectral_rolloff_hz", "rolloff_hz", "rolloffHz"]) ??
    spectralFromVersion.spectral_rolloff_hz ??
    null,
  spectral_centroid_hz:
    pickNum(spectralSrc, ["spectral_centroid_hz", "centroid_hz", "centroidHz"]) ??
    spectralFromVersion.spectral_centroid_hz ??
    null,
  spectral_bandwidth_hz:
    pickNum(spectralSrc, ["spectral_bandwidth_hz", "bandwidth_hz", "bandwidthHz"]) ??
    spectralFromVersion.spectral_bandwidth_hz ??
    null,
};



const loudness: Loudness = {
  integrated_lufs:
    pickNum(version, ["lufs"]) ??
    pickNum(analyzer, ["loudness_stats.integrated_lufs"]) ??
    pickNum(analyzer, ["lufs"]) ??
    null,

  lra: pickNum(analyzer, ["loudness_stats.lra"]) ?? null,

  // FIX: sample peak deve guardare sample_peak_db (non true_peak_db)
  sample_peak_db:
    pickNum(analyzer, ["loudness_stats.sample_peak_db"]) ??
    null,

  true_peak_db:
    pickNum(analyzer, ["loudness_stats.true_peak_db"]) ??
    null,

  true_peak_method:
    pickStr(analyzer, ["loudness_stats.true_peak_method"]) ??
    null,

  momentary_percentiles: null,
  short_term_percentiles: null,
  sections: null,
};



  const bpm =
    pickNum(versionRecord, ["analyzer_bpm"]) ??
    pickNum(analyzer, ["bpm", "rhythm.bpm"]) ??
    null;

  const key =
    pickStr(versionRecord, ["analyzer_key"]) ??
    pickStr(analyzer, ["key", "rhythm.key"]) ??
    null;

  const model: AnalyzerCompareModel = {
    projectTitle: pickStr(versionRecord, ["project.0.title", "project.title"]) ?? "Untitled project",
    versionName: pickStr(versionRecord, ["version_name"]) ?? "Untitled version",
    mixType: "MASTER",
    bpm,
    key,
    overallScore: pickNum(versionRecord, ["overall_score"]),
    referenceName: pickStr(versionRecord, ["reference_model_key"]),
    bandsNorm,
    spectral,
    loudness,
    referenceBandsNorm: referenceBandsNormFinal,
    referenceBandsPercentiles,
    referenceFeaturesPercentiles,
    referenceStereoPercentiles: extractStereoPercentiles(referenceModel),
    referenceRhythmPercentiles: extractRhythmPercentiles(referenceModel),
    referenceRhythmDescriptorsPercentiles: extractRhythmDescriptorsPercentiles(referenceModel),
    referenceTransientsPercentiles: extractTransientsPercentiles(referenceModel),
    referenceSpectralPercentiles: extractSpectralPercentiles(referenceModel),
    referenceSoundField: extractSoundFieldRef(referenceModel),
    referenceSoundFieldXY: extractSoundFieldXYRef(referenceModel),
    spectrumTrack: null,
    spectrumRef: referenceModel ? extractSpectrumRef(referenceModel) : null,
    soundField: null,
    levels: null,
    transients: null,
    momentaryLufs,
    shortTermLufs,
  };

  // arrays.json -> loudness fallback (se presente)
  if (isRecord(arrays?.loudness_stats)) {
    const ls = arrays.loudness_stats;

    if (!model.loudness) model.loudness = {};
    if (isNumber(ls.integrated_lufs)) model.loudness.integrated_lufs = ls.integrated_lufs;
    if (isNumber(ls.lra)) model.loudness.lra = ls.lra;
    if (isNumber(ls.sample_peak_db)) model.loudness.sample_peak_db = ls.sample_peak_db;

    // true peak + method
    if (isNumber(ls.true_peak_db)) model.loudness.true_peak_db = ls.true_peak_db;
    if (isString(ls.true_peak_method))
      model.loudness.true_peak_method = ls.true_peak_method.trim();
  }

  // percentili + sezioni (arrays.json)
  if (arrays) {
    if (!model.loudness) model.loudness = {};

    const mp = pickPercentiles3(arrays.momentary_percentiles);
    const sp = pickPercentiles3(arrays.short_term_percentiles);
    if (mp) model.loudness.momentary_percentiles = mp;
    if (sp) model.loudness.short_term_percentiles = sp;

    if (isRecord(arrays.sections)) {
      model.loudness.sections = arrays.sections as Loudness["sections"];
    }
  }

  // spectrum_db -> spectrumTrack (da arrays.json)
  {
    const s = pickSpectrumDb(arrays);
    if (s) {
      const pts = toSpectrumPoints(s.hz, s.db);
      model.spectrumTrack = pts.length ? pts : null;
    }
  }

  // sound_field -> soundField (supporta sia shape {angle_deg:[], radius:[]} che [{angle_deg, radius}, ...])
  {
    const sf = arrays?.sound_field_polar ?? arrays?.sound_field;
    const pts: { angleDeg: number; radius: number }[] = [];

    if (Array.isArray(sf)) {
      for (const p of sf) {
        if (!isRecord(p)) continue;
        const a = p.angle_deg;
        const r = p.radius;
        if (isNumber(a) && isNumber(r)) {
          pts.push({ angleDeg: a, radius: r });
        }
      }
    } else if (isRecord(sf)) {
      const a = sf.angle_deg;
      const r = sf.radius;
      if (Array.isArray(a) && Array.isArray(r)) {
        for (let i = 0; i < Math.min(a.length, r.length); i++) {
          if (isNumber(a[i]) && isNumber(r[i])) {
            pts.push({ angleDeg: a[i], radius: r[i] });
          }
        }
      }
    }

    model.soundField = pts.length ? pts : null;
  }

  // sound_field_xy -> soundFieldXY
  {
    const sf = arrays?.sound_field_xy;
    const pts: { x: number; y: number }[] = [];
    if (Array.isArray(sf)) {
      for (const p of sf) {
        if (!isRecord(p)) continue;
        const x = p.x;
        const y = p.y;
        if (isNumber(x) && isNumber(y)) {
          pts.push({ x, y });
        }
      }
    }
    model.soundFieldXY = pts.length ? pts : null;
  }

  // levels -> levels
  if (isRecord(arrays?.levels)) {
    const levels = pick(arrays, ["levels"]);
    if (isRecord(levels)) {
      if (Array.isArray(levels.channels) && Array.isArray(levels.rms_db) && Array.isArray(levels.peak_db)) {
        const ch = levels.channels;
        const rms = levels.rms_db;
        const peak = levels.peak_db;
        const out: LevelMeter[] = [];
        for (let i = 0; i < Math.min(ch.length, rms.length, peak.length); i++) {
          if (isString(ch[i]) && isLevelLabel(ch[i]) && isNumber(rms[i]) && isNumber(peak[i])) {
            out.push({ label: ch[i], rmsDb: rms[i], peakDb: peak[i] });
          }
        }
        model.levels = out.length ? out : null;
      } else {
        const rmsL = pickNum(levels, ["rms_db_l", "rmsDbL"]);
        const rmsR = pickNum(levels, ["rms_db_r", "rmsDbR"]);
        const peakL = pickNum(levels, ["peak_db_l", "peakDbL"]);
        const peakR = pickNum(levels, ["peak_db_r", "peakDbR"]);
        const out: LevelMeter[] = [];
        if (isNumber(rmsL) && isNumber(peakL)) out.push({ label: "L", rmsDb: rmsL, peakDb: peakL });
        if (isNumber(rmsR) && isNumber(peakR)) out.push({ label: "R", rmsDb: rmsR, peakDb: peakR });
        model.levels = out.length ? out : null;
      }
    }
  }

  // transients -> transients
  {
    const tCandidate =
      pick(arrays, ["transients"]) ??
      pick(analyzer, ["transients", "arrays_blob.transients", "analysis_pro.transients"]) ??
      null;

    if (isRecord(tCandidate)) {
      const t = tCandidate;
      const strengthVal = isNumber(t.strength) ? t.strength : null;
      const densityVal = isNumber(t.density) ? t.density : null;

      const crestVal =
        isNumber(t.crestFactorDb)
          ? t.crestFactorDb
          : isNumber(t.crest_factor_db)
            ? t.crest_factor_db
            : null;

      const logAttackVal =
        isNumber(t.log_attack_time)
          ? t.log_attack_time
          : isNumber(t.logAttackTime)
            ? t.logAttackTime
            : null;

      const hasAny = [strengthVal, densityVal, crestVal, logAttackVal].some(
        (v) => typeof v === "number" && Number.isFinite(v)
      );
      model.transients = hasAny
        ? {
            strength: strengthVal,
            density: densityVal,
            crestFactorDb: crestVal,
            log_attack_time: logAttackVal,
          }
        : null;
    } else {
      model.transients = null;
    }
  }

  // stereo (arrays.json)
  model.stereoWidth =
    typeof arrays?.stereo_width === "number" && Number.isFinite(arrays.stereo_width)
      ? arrays.stereo_width
      : null;

  model.widthByBand = sanitizeBands(arrays?.width_by_band);

  model.correlation = (() => {
    const a = ensureNumArr(arrays?.correlation);
    return a.length ? a : null;
  })();

  model.stereoSummary = (() => {
    const s = arrays?.stereo_summary;
    if (!s || typeof s !== "object") return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  })();

  // rhythm (arrays.json)
  model.rhythm = {
    relative_key:
      pickStr(arrays, ["relative_key"]) ??
      pickStr(arrays, ["rhythm_descriptors.relative_key"]) ??
      null,
    danceability: pickNum(arrays, ["danceability"]) ?? null,
    beat_times: (() => {
      const bt = ensureNumArr(arrays?.beat_times);
      return bt.length ? bt : null;
    })(),
    descriptors: (() => {
      const d = arrays?.rhythm_descriptors;
      if (!d || typeof d !== "object") return null;
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(d)) {
        if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      }
      return Object.keys(out).length ? out : null;
    })(),
  };

  // extra (arrays.json)
  const extraCandidate =
    pick(arrays, ["extra"]) ??
    pick(analyzer, ["extra", "analysis_pro.extra"]) ??
    null;

  model.extra = {
    mfcc_mean: (() => {
      const m = ensureNumArr(
        pick(arrays, ["mfcc_mean"]) ??
        pick(extraCandidate, ["mfcc_mean", "mfcc.mean"]) ??
        null
      );
      return m.length ? m : null;
    })(),
    hfc: pickNum(arrays, ["hfc"]) ?? pickNum(extraCandidate, ["hfc"]) ?? null,
    spectral_peaks_count:
      pickNum(arrays, ["spectral_peaks_count"]) ??
      pickNum(extraCandidate, ["spectral_peaks_count", "spectral_peaks.count"]) ??
      null,
    spectral_peaks_energy:
      pickNum(arrays, ["spectral_peaks_energy"]) ??
      pickNum(extraCandidate, ["spectral_peaks_energy", "spectral_peaks.energy"]) ??
      null,
  };

  // FIX: rendi spectrumRef sempre confrontabile col track (stesso asse/lunghezza)
  if (model.spectrumTrack?.length && model.spectrumRef?.length) {
    const hzTarget = model.spectrumTrack.map((p) => p.hz);
    const hzRef = model.spectrumRef.map((p) => p.hz);
    const dbRef = model.spectrumRef.map((p) => p.mag);

    if (hzTarget.length !== hzRef.length) {
      const resampled = resampleSpectrumLinear(hzTarget, hzRef, dbRef);
      if (resampled.length === hzTarget.length) {
        model.spectrumRef = hzTarget.map((hz, i) => ({ hz, mag: resampled[i] }));
      }
    }
  }

  console.log("[V2 DEBUG] spectrumTrack", {
    len: model.spectrumTrack?.length,
  });

  console.log("[V2 DEBUG] spectrumRef", {
    len: model.spectrumRef?.length,
    refKey: model.referenceName,
  });

  return model;
}
