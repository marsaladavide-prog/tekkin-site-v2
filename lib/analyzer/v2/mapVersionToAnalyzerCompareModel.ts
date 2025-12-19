import type { AnalyzerCompareModel, Bands, Spectral, Loudness } from "./types";

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

export function mapVersionToAnalyzerCompareModel(version: any): AnalyzerCompareModel {
  const analyzer = version?.analyzer_json ?? null;

  const bandsNorm = (version?.analyzer_bands_norm ?? analyzer?.spectral?.band_norm ?? null) as Bands | null;

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

    bandsNorm: bandsNorm && typeof bandsNorm === "object" ? bandsNorm : null,
    spectral,
    loudness,

    // Reference: per ora off (null) perché nel tuo page.tsx non carichi reference model
    referenceName: null,
    referenceBandsNorm: null,

    // Grafici advanced: per ora null finché non li scriviamo in arrays.json
    spectrumTrack: null,
    spectrumRef: null,
    soundField: null,
    levels: null,
  };

  const arr = version?.analyzer_arrays ?? null;

  const rhythm = arr?.analysis_pro?.rhythm ?? null;

  // debug temporaneo: ti fa vedere cosa contiene
  // (toglilo dopo)
  if (rhythm) {
    // eslint-disable-next-line no-console
    console.log("[V2 mapper] rhythm keys:", Object.keys(rhythm));
  }

  // arrays.json -> loudness fallback (se presente)
  if (arr?.loudness_stats && typeof arr.loudness_stats === "object") {
    const ls = arr.loudness_stats as any;

    if (!model.loudness) model.loudness = {};
    if (typeof ls.integrated_lufs === "number") model.loudness.integrated_lufs = ls.integrated_lufs;
    if (typeof ls.lra === "number") model.loudness.lra = ls.lra;
    if (typeof ls.sample_peak_db === "number") model.loudness.sample_peak_db = ls.sample_peak_db;
  }

  // spectrum_db -> spectrumTrack
  if (arr?.spectrum_db?.hz && arr?.spectrum_db?.track_db) {
    const hz: any[] = arr.spectrum_db.hz;
    const db: any[] = arr.spectrum_db.track_db;
    const pts: { hz: number; mag: number }[] = [];
    for (let i = 0; i < Math.min(hz.length, db.length); i++) {
      if (typeof hz[i] === "number" && typeof db[i] === "number") pts.push({ hz: hz[i], mag: db[i] });
    }
    model.spectrumTrack = pts.length ? pts : null;
  }

  // sound_field -> soundField
  if (arr?.sound_field?.angle_deg && arr?.sound_field?.radius) {
    const a: any[] = arr.sound_field.angle_deg;
    const r: any[] = arr.sound_field.radius;
    const pts: { angleDeg: number; radius: number }[] = [];
    for (let i = 0; i < Math.min(a.length, r.length); i++) {
      if (typeof a[i] === "number" && typeof r[i] === "number") pts.push({ angleDeg: a[i], radius: r[i] });
    }
    model.soundField = pts.length ? pts : null;
  }

  // levels -> levels
  if (arr?.levels?.channels && arr?.levels?.rms_db && arr?.levels?.peak_db) {
    const ch: any[] = arr.levels.channels;
    const rms: any[] = arr.levels.rms_db;
    const peak: any[] = arr.levels.peak_db;
    const out: any[] = [];
    for (let i = 0; i < Math.min(ch.length, rms.length, peak.length); i++) {
      if (typeof ch[i] === "string" && typeof rms[i] === "number" && typeof peak[i] === "number") {
        out.push({ label: ch[i], rmsDb: rms[i], peakDb: peak[i] });
      }
    }
    model.levels = out.length ? out : null;
  }

  return model;
}
