import type {
  AnalyzerCompareModel,
  Bands,
  BandsPercentiles,
  SpectrumPoint,
  Spectral,
  Loudness,
  ReferenceStereoPercentiles,
  PercentileRange,
} from "./types";

function pick(obj: any, paths: string[]) {
  for (const p of paths) {
    const v = p.split(".").reduce((acc, k) => acc?.[k], obj);
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

function pickFromList<T>(arr: T[], seed: number, i: number) {
  if (!arr.length) return arr[0];
  const idx = (seed + i * 2654435761) % arr.length;
  return arr[idx];
}


function pickNum(obj: any, paths: string[]) {
  const v = pick(obj, paths);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pickStr(obj: any, paths: string[]) {
  const v = pick(obj, paths);
  return typeof v === "string" && v.trim() ? v : null;
}

const BAND_KEYS: Array<keyof Bands> = ["sub", "low", "lowmid", "mid", "presence", "high", "air"];

function sanitizeBands(value: any): Bands | null {
  if (!value || typeof value !== "object") return null;
  const out: Bands = {};
  let has = false;
  for (const key of BAND_KEYS) {
    const candidate = (value as Record<string, unknown>)[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      out[key] = candidate;
      has = true;
    }
  }
  return has ? out : null;
}

function extractBandsPercentiles(reference: any): BandsPercentiles | null {
  const percentiles = reference?.bands_norm_percentiles;
  if (!percentiles || typeof percentiles !== "object") return null;
  const out: BandsPercentiles = {};
  let has = false;
  for (const key of BAND_KEYS) {
    const bandPerc = percentiles[key];
    if (bandPerc && typeof bandPerc === "object") {
      const p: any = {};
      if (typeof bandPerc.p10 === "number") p.p10 = bandPerc.p10;
      if (typeof bandPerc.p25 === "number") p.p25 = bandPerc.p25;
      if (typeof bandPerc.p50 === "number") p.p50 = bandPerc.p50;
      if (typeof bandPerc.p75 === "number") p.p75 = bandPerc.p75;
      if (typeof bandPerc.p90 === "number") p.p90 = bandPerc.p90;
      if (Object.keys(p).length > 0) {
        out[key] = p;
        has = true;
      }
    }
  }
  return has ? out : null;
}

function buildPercentileRange(value: any): PercentileRange | null {
  if (!value || typeof value !== "object") return null;
  const out: PercentileRange = {};
  if (typeof value.p10 === "number") out.p10 = value.p10;
  if (typeof value.p50 === "number") out.p50 = value.p50;
  if (typeof value.p90 === "number") out.p90 = value.p90;
  return Object.keys(out).length ? out : null;
}

function extractStereoPercentiles(reference: any): ReferenceStereoPercentiles | null {
  const stereo = reference?.stereo_percentiles;
  if (!stereo || typeof stereo !== "object") return null;
  const lrBalance = buildPercentileRange(stereo.lr_balance_db);
  const lrCorrelation = buildPercentileRange(stereo.lr_correlation);

  const out: ReferenceStereoPercentiles = {};
  if (lrBalance) out.lrBalanceDb = lrBalance;
  if (lrCorrelation) out.lrCorrelation = lrCorrelation;
  return Object.keys(out).length ? out : null;
}

function extractSpectrumRef(referenceModel: any): SpectrumPoint[] | null {
  const hz: any[] = referenceModel?.spectrum_db?.hz;
  const refDb: any[] =
    referenceModel?.spectrum_db?.ref_db ??
    referenceModel?.spectrum_db?.mean_db ??
    referenceModel?.spectrum_db?.db ??
    null;

  if (!Array.isArray(hz) || !Array.isArray(refDb)) return null;

  const n = Math.min(hz.length, refDb.length);
  const out: SpectrumPoint[] = [];

  for (let i = 0; i < n; i += 1) {
    const h = hz[i];
    const d = refDb[i];
    if (typeof h !== "number" || !Number.isFinite(h)) continue;
    if (typeof d !== "number" || !Number.isFinite(d)) continue;
    out.push({ hz: h, mag: d });
  }

  return out.length ? out : null;
}

function ensureNumberArray(value: any): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
}



function toSpectrumPoints(hzArr: any, dbArr: any): SpectrumPoint[] {
  const hz = Array.isArray(hzArr) ? hzArr : [];
  const db = Array.isArray(dbArr) ? dbArr : [];
  const pts: SpectrumPoint[] = [];

  for (let i = 0; i < Math.min(hz.length, db.length); i++) {
    const h = hz[i];
    const d = db[i];
    if (typeof h === "number" && Number.isFinite(h) && typeof d === "number" && Number.isFinite(d)) {
      pts.push({ hz: h, mag: d });
    }
  }

  return pts;
}

function pickSpectrumDb(obj: any): { hz: any; db: any } | null {
  const s = obj?.spectrum_db ?? obj?.spectrumDb ?? null;
  if (!s || typeof s !== "object") return null;

  // reference models: { hz: [], ref_db: [] }
  if (Array.isArray(s.hz) && Array.isArray(s.ref_db)) return { hz: s.hz, db: s.ref_db };

  // arrays.json: { hz: [], track_db: [] }
  if (Array.isArray(s.hz) && Array.isArray(s.track_db)) return { hz: s.hz, db: s.track_db };

  return null;
}

function safeJsonParse(v: string) {
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

function pickPercentiles3(obj: any): { p10?: number; p50?: number; p90?: number } | null {
  if (!obj || typeof obj !== "object") return null;
  const p10 = typeof obj.p10 === "number" ? obj.p10 : null;
  const p50 = typeof obj.p50 === "number" ? obj.p50 : null;
  const p90 = typeof obj.p90 === "number" ? obj.p90 : null;
  if (p10 == null && p50 == null && p90 == null) return null;
  const out: any = {};
  if (p10 != null) out.p10 = p10;
  if (p50 != null) out.p50 = p50;
  if (p90 != null) out.p90 = p90;
  return out;
}

function ensureNumArr(v: any): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "number" && Number.isFinite(x));
}

export function mapVersionToAnalyzerCompareModel(version: any, referenceModel?: any): AnalyzerCompareModel {


  const analyzer =
    typeof (version as any).analyzer_json === "string"
      ? safeJsonParse((version as any).analyzer_json)
      : (version as any).analyzer_json;
  const arrays = version?.analyzer_arrays ?? null;

  const trackBandsCandidate =
    version?.analyzer_bands_norm ??
    analyzer?.bands_norm ??
    analyzer?.band_energy_norm ??
    analyzer?.spectral?.band_norm ??
    analyzer?.band_norm ??
    null;

  const referenceBandsCandidate =
    version?.reference_bands_norm ??
    analyzer?.reference_bands_norm ??
    (analyzer?.reference && typeof analyzer.reference === "object" ? analyzer.reference.bands_norm : null) ??
    null;

  const momentaryLufs = ensureNumArr(arrays?.loudness_stats?.momentary_lufs);
  const shortTermLufs = ensureNumArr(arrays?.loudness_stats?.short_term_lufs);

  const bandsNorm = sanitizeBands(trackBandsCandidate);
  const referenceBandsNorm = sanitizeBands(referenceBandsCandidate);
  const referenceBandsPercentiles = extractBandsPercentiles(referenceModel);
  const referenceLoudnessPercentiles = buildPercentileRange(referenceModel?.features_percentiles?.lufs);
  const referenceFeaturesPercentiles = referenceLoudnessPercentiles ? { lufs: referenceLoudnessPercentiles } : null;

  const referenceBandsFromModel = sanitizeBands(referenceModel?.bands_norm ?? null);
  const referenceBandsNormFinal = referenceBandsNorm ?? referenceBandsFromModel;

const spectralSrc = (arrays?.spectral && typeof arrays.spectral === "object") ? arrays.spectral : analyzer?.spectral;

const spectral: Spectral = {
  spectral_flatness:
    pickNum(spectralSrc, ["spectral_flatness", "flatness"]) ??
    null,
  zero_crossing_rate:
    pickNum(spectralSrc, ["zero_crossing_rate", "zcr"]) ??
    null,
  spectral_rolloff_hz:
    pickNum(spectralSrc, ["spectral_rolloff_hz", "rolloff_hz", "rolloffHz"]) ??
    null,
  spectral_centroid_hz:
    pickNum(spectralSrc, ["spectral_centroid_hz", "centroid_hz", "centroidHz"]) ??
    null,
  spectral_bandwidth_hz:
    pickNum(spectralSrc, ["spectral_bandwidth_hz", "bandwidth_hz", "bandwidthHz"]) ??
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
    (typeof version?.analyzer_bpm === "number" ? version.analyzer_bpm : null) ??
    pickNum(analyzer, ["bpm"]) ??
    null;

  const key =
    (typeof version?.analyzer_key === "string" ? version.analyzer_key : null) ??
    pickStr(analyzer, ["key"]) ??
    null;

  const model: AnalyzerCompareModel = {
    projectTitle: version?.project?.title ?? "Untitled project",
    versionName: version?.version_name ?? "Untitled version",
    mixType: "MASTER",

    bpm: bpm != null ? Math.round(bpm) : null,
    key,
    overallScore: typeof version?.overall_score === "number" ? version.overall_score : null,

    bandsNorm,
    spectral,
    loudness,

    referenceName:
      (typeof version?.reference_model_key === "string" && version.reference_model_key.trim()
        ? version.reference_model_key.trim()
        : null) ??
      (typeof version?.analyzer_profile_key === "string" && version.analyzer_profile_key.trim()
        ? version.analyzer_profile_key.trim()
        : null) ??
      null,
    referenceBandsNorm: referenceBandsNormFinal,
    referenceBandsPercentiles,
    referenceFeaturesPercentiles,
    referenceStereoPercentiles: referenceModel ? extractStereoPercentiles(referenceModel) : null,

    spectrumTrack: null,
    spectrumRef: referenceModel ? extractSpectrumRef(referenceModel) : null,
    soundField: null,
    levels: null,
    transients: null,

    momentaryLufs,
    shortTermLufs,
  };

  // arrays.json -> loudness fallback (se presente)
  if (arrays?.loudness_stats && typeof arrays.loudness_stats === "object") {
    const ls = arrays.loudness_stats as any;

    if (!model.loudness) model.loudness = {};
    if (typeof ls.integrated_lufs === "number") model.loudness.integrated_lufs = ls.integrated_lufs;
    if (typeof ls.lra === "number") model.loudness.lra = ls.lra;
    if (typeof ls.sample_peak_db === "number") model.loudness.sample_peak_db = ls.sample_peak_db;

    // true peak + method
    if (typeof ls.true_peak_db === "number") model.loudness.true_peak_db = ls.true_peak_db;
    if (typeof ls.true_peak_method === "string" && ls.true_peak_method.trim())
      model.loudness.true_peak_method = ls.true_peak_method.trim();
  }

  // percentili + sezioni (arrays.json)
  if (arrays) {
    if (!model.loudness) model.loudness = {};

    const mp = pickPercentiles3(arrays.momentary_percentiles);
    const sp = pickPercentiles3(arrays.short_term_percentiles);
    if (mp) model.loudness.momentary_percentiles = mp as any;
    if (sp) model.loudness.short_term_percentiles = sp as any;

    if (arrays.sections && typeof arrays.sections === "object") {
      model.loudness.sections = arrays.sections as any;
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

  // sound_field -> soundField
  if (arrays?.sound_field?.angle_deg && arrays?.sound_field?.radius) {
    const a: any[] = arrays.sound_field.angle_deg;
    const r: any[] = arrays.sound_field.radius;
    const pts: { angleDeg: number; radius: number }[] = [];
    for (let i = 0; i < Math.min(a.length, r.length); i++) {
      if (typeof a[i] === "number" && typeof r[i] === "number") pts.push({ angleDeg: a[i], radius: r[i] });
    }
    model.soundField = pts.length ? pts : null;
  }

  // levels -> levels
  if (arrays?.levels?.channels && arrays?.levels?.rms_db && arrays?.levels?.peak_db) {
    const ch: any[] = arrays.levels.channels;
    const rms: any[] = arrays.levels.rms_db;
    const peak: any[] = arrays.levels.peak_db;
    const out: any[] = [];
    for (let i = 0; i < Math.min(ch.length, rms.length, peak.length); i++) {
      if (typeof ch[i] === "string" && typeof rms[i] === "number" && typeof peak[i] === "number") {
        out.push({ label: ch[i], rmsDb: rms[i], peakDb: peak[i] });
      }
    }
    model.levels = out.length ? out : null;
  }

  // transients -> transients
  {
    const tCandidate =
      (arrays?.transients && typeof arrays.transients === "object" ? arrays.transients : null) ??
      (analyzer?.transients && typeof analyzer.transients === "object" ? analyzer.transients : null) ??
      (analyzer?.arrays_blob?.transients && typeof analyzer.arrays_blob.transients === "object"
        ? analyzer.arrays_blob.transients
        : null) ??
      null;

    if (tCandidate) {
      const t = tCandidate as any;
      const out: any = {};

      if (typeof t.strength === "number" && Number.isFinite(t.strength)) out.strength = t.strength;
      if (typeof t.density === "number" && Number.isFinite(t.density)) out.density = t.density;

      const crest =
        typeof t.crestFactorDb === "number"
          ? t.crestFactorDb
          : typeof t.crest_factor_db === "number"
            ? t.crest_factor_db
            : null;
      if (typeof crest === "number" && Number.isFinite(crest)) out.crestFactorDb = crest;

      const logAttack =
        typeof t.log_attack_time === "number"
          ? t.log_attack_time
          : typeof t.logAttackTime === "number"
            ? t.logAttackTime
            : null;
      if (typeof logAttack === "number" && Number.isFinite(logAttack)) {
        out.log_attack_time = logAttack;
      }

      model.transients = Object.keys(out).length ? out : null;
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
    relative_key: pickStr(arrays, ["relative_key"]) ?? null,
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
  model.extra = {
    mfcc_mean: (() => {
      const m = ensureNumArr(arrays?.mfcc_mean);
      return m.length ? m : null;
    })(),
    hfc: pickNum(arrays, ["hfc"]) ?? null,
    spectral_peaks_count: pickNum(arrays, ["spectral_peaks_count"]) ?? null,
    spectral_peaks_energy: pickNum(arrays, ["spectral_peaks_energy"]) ?? null,
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
