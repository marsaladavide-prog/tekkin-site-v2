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
  const refDb: any[] = referenceModel?.spectrum_db?.ref_db;

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

type SpectrumPoint = { hz: number; mag: number };

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

  const momentaryLufs = ensureNumberArray(arrays?.loudness_stats?.momentary_lufs);
  const shortTermLufs = ensureNumberArray(arrays?.loudness_stats?.short_term_lufs);

  const bandsNorm = sanitizeBands(trackBandsCandidate);
  const referenceBandsNorm = sanitizeBands(referenceBandsCandidate);
  const referenceBandsPercentiles = extractBandsPercentiles(referenceModel);

  const spectral: Spectral = {
    spectral_flatness: pickNum(version, ["analyzer_json.spectral_flatness", "analyzer_json.spectral.spectral_flatness", "analyzer_json.spectral.spectral_flatness_mean"]),
    zero_crossing_rate: pickNum(version, ["analyzer_json.zero_crossing_rate", "analyzer_json.spectral.zero_crossing_rate"]),
    spectral_rolloff_hz: pickNum(version, ["analyzer_json.spectral_rolloff_hz", "analyzer_json.spectral.spectral_rolloff_hz"]),
    spectral_centroid_hz: pickNum(version, ["analyzer_json.spectral_centroid_hz", "analyzer_json.spectral.spectral_centroid_hz"]),
    spectral_bandwidth_hz: pickNum(version, ["analyzer_json.spectral_bandwidth_hz", "analyzer_json.spectral.spectral_bandwidth_hz"]),
  };

  const loudness: Loudness = {
    integrated_lufs:
      pickNum(version, ["lufs", "analyzer_json.lufs", "analyzer_json.loudness_stats.integrated_lufs"]) ??
      null,
    lra: pickNum(version, ["analyzer_json.loudness_stats.lra"]) ?? null,
    // per ora mappo true_peak_db o sample_peak_db se presente
    sample_peak_db:
      pickNum(version, ["analyzer_json.loudness_stats.true_peak_db", "analyzer_json.loudness_stats.sample_peak_db"]) ??
      null,
    rms_db: pickNum(version, ["analyzer_json.loudness_stats.rms_db"]) ?? null,
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

    referenceName: version?.reference_model_key ?? null,
    referenceBandsNorm,
    referenceBandsPercentiles: referenceModel ? extractBandsPercentiles(referenceModel) : null,
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
  }

  // arrays.json -> transients
  const tr = (arrays as any)?.transients;
  if (tr && typeof tr === "object") {
    const strength = typeof tr.strength === "number" && Number.isFinite(tr.strength) ? tr.strength : null;
    const density = typeof tr.density === "number" && Number.isFinite(tr.density) ? tr.density : null;

    // supporta sia crest_factor_db (python) che crestFactorDb (eventuale)
    const crestFactorDb =
      typeof tr.crest_factor_db === "number" && Number.isFinite(tr.crest_factor_db)
        ? tr.crest_factor_db
        : typeof tr.crestFactorDb === "number" && Number.isFinite(tr.crestFactorDb)
          ? tr.crestFactorDb
          : null;

    if (strength !== null || density !== null || crestFactorDb !== null) {
      model.transients = { strength, density, crestFactorDb };
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

  // spectrum_db -> spectrumRef (da reference model)
  {
    const refCandidate =
      referenceModel ??
      version?.reference_model_json ??
      version?.reference_model ??
      version?.referenceModel ??
      null;

    const s = pickSpectrumDb(refCandidate);
    if (s) {
      const pts = toSpectrumPoints(s.hz, s.db);
      model.spectrumRef = pts.length ? pts : null;
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
    const analyzerRaw = (version as any).analyzer_json;

    const analyzer =
      typeof analyzerRaw === "string"
        ? (() => {
            try {
              return JSON.parse(analyzerRaw);
            } catch {
              return null;
            }
          })()
        : analyzerRaw;

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

      model.transients = Object.keys(out).length ? out : null;
    } else {
      model.transients = null;
    }
  }

  // Fix UX: if transients look like a fallback (0/0 with crest present), mark strength/density as null
  if (model.transients) {
    const t = model.transients as any;
    const isFallback = t.strength === 0 && t.density === 0 && (t.crestFactorDb ?? 0) > 0;
    if (isFallback) {
      model.transients = { ...t, strength: null, density: null };
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
