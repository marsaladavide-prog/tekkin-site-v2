import type { JsonObject } from "@/types/json";
import { isJsonObject } from "@/types/json";

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function getObj(v: unknown): JsonObject | null {
  return isJsonObject(v) ? v : null;
}

function getNum(obj: JsonObject | null, key: string): number | null {
  if (!obj) return null;
  const v = obj[key];
  return isFiniteNumber(v) ? v : null;
}

function getStr(obj: JsonObject | null, key: string): string | null {
  if (!obj) return null;
  const v = obj[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function pointsToAngleRadius(soundField: unknown): { angle_deg: number[]; radius: number[] } | null {
  if (!Array.isArray(soundField)) return null;
  const angle: number[] = [];
  const radius: number[] = [];

  for (const p of soundField) {
    const po = getObj(p);
    if (!po) continue;
    const a = getNum(po, "angle_deg");
    const r = getNum(po, "radius");
    if (a == null || r == null) continue;
    angle.push(a);
    radius.push(r);
  }

  if (!angle.length || !radius.length) return null;
  return { angle_deg: angle, radius };
}

/**
 * Adatta l'output Analyzer V3 (blocks.*.data) alla shape "legacy" attesa oggi dal sito:
 * - loudness_stats
 * - spectral
 * - band_energy_norm
 * - stereo_width
 * - arrays_blob (loudness arrays + spectrum + sound_field + transients)
 *
 * Non inventa dati: se mancano, lascia null/omette.
 */
export function adaptAnalyzerV3ToLegacy(payload: JsonObject): JsonObject {
  const blocks = getObj(payload["blocks"]);
  const meta = getObj(payload["meta"]);

  const loudBlock = getObj(blocks?.["loudness"]);
  const timbreBlock = getObj(blocks?.["timbre_spectrum"]);
  const stereoBlock = getObj(blocks?.["stereo"]);
  const transBlock = getObj(blocks?.["transients"]);
  const rhythmBlock = getObj(blocks?.["rhythm"]);

  const loudData = getObj(loudBlock?.["data"]);
  const timbreData = getObj(timbreBlock?.["data"]);
  const stereoData = getObj(stereoBlock?.["data"]);
  const transData = getObj(transBlock?.["data"]);
  const rhythmData = getObj(rhythmBlock?.["data"]);

  const integrated = getNum(loudData, "integrated_lufs");
  const lra = getNum(loudData, "lra");
  const samplePeakDb = getNum(loudData, "sample_peak_db");

  const spectralObj = getObj(timbreData?.["spectral"]);
  const bandsNormObj = getObj(timbreData?.["bands_norm"]);
  const spectrumDbObj = getObj(timbreData?.["spectrum_db"]);

  const stereoWidth = getNum(stereoData, "stereo_width");
  const widthByBandObj = getObj(stereoData?.["width_by_band"]);

  // sound_field può arrivare come lista punti (view) o già come oggetto angle/radius
  const soundFieldRaw = stereoData?.["sound_field"];
  const soundFieldObj = getObj(soundFieldRaw) ?? pointsToAngleRadius(soundFieldRaw);

  const correlationArr = Array.isArray(stereoData?.["correlation"]) ? stereoData?.["correlation"] : null;

  const bpm = getNum(rhythmData, "bpm");

  const warnings: string[] = [];
  for (const [name, blk] of Object.entries(blocks ?? {})) {
    const b = getObj(blk);
    if (!b) continue;
    const ok = b["ok"];
    if (ok === false) {
      const err = typeof b["error"] === "string" ? b["error"] : "block_failed";
      warnings.push(`${name}:${err}`);
    }
  }

  // arrays_blob: lo usi già come fonte primaria in UI per arrays e patch
  const arrays_blob: JsonObject = {};

  if (loudData) {
    const momentary = loudData["momentary_lufs"];
    const shortTerm = loudData["short_term_lufs"];
    arrays_blob["loudness_stats"] = {
      momentary_lufs: Array.isArray(momentary) ? momentary : null,
      short_term_lufs: Array.isArray(shortTerm) ? shortTerm : null,
      integrated_lufs: integrated,
      lra,
      sample_peak_db: samplePeakDb,
    };
  }

  if (spectrumDbObj) {
    arrays_blob["spectrum_db"] = spectrumDbObj;
  }

  if (soundFieldObj) {
    arrays_blob["sound_field"] = soundFieldObj;
  }

  if (correlationArr) {
    arrays_blob["stereo"] = { correlation: correlationArr };
  }

  if (transData) {
    arrays_blob["transients"] = transData;
  }

  // mantieni compatibilità con patcher levels placeholder
  arrays_blob["levels"] = {
    channels: ["L", "R"],
    rms_db: [integrated ?? -24, integrated ?? -24],
    peak_db: [samplePeakDb ?? -12, samplePeakDb ?? -12],
  };

  // pass-through se l'API analyzer li restituisce già
  const arrays_blob_path = getStr(payload, "arrays_blob_path");
  const arrays_blob_size_bytes = getNum(payload, "arrays_blob_size_bytes");

  const profile_key = getStr(payload, "profile_key") ?? getStr(meta, "profile_key") ?? null;

  // Shape legacy finale
  return {
    // metadati base
    profile_key,
    bpm,
    warnings,

    // scalari attesi dal mapper
    loudness_stats: {
      integrated_lufs: integrated,
      lra,
      sample_peak_db: samplePeakDb,
      warnings,
    },

    spectral: spectralObj ?? null,
    band_energy_norm: bandsNormObj ?? null,

    // extra stereo
    stereo_width: stereoWidth,
    stereo_percentiles: widthByBandObj ?? null,

    // arrays per UI/patch
    arrays_blob,

    // se disponibili
    arrays_blob_path,
    arrays_blob_size_bytes,

    // teniamo anche il payload V3 intero per debug eventuale
    v3: payload,
  };
}
