import type { JsonObject } from "@/types/json";
import { isJsonObject } from "@/types/json";
import type { BandsNorm } from "@/lib/reference/types";

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function scoreFromDistance01(distance01: number) {
  // distance01: 0 perfetto, 1 pessimo
  const d = clamp(distance01, 0, 1);
  return clamp(Math.round(lerp(100, 0, d)), 0, 100);
}

// Penalità morbida: 0..1
function penaltyOutside(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < min) return clamp((min - value) / (min || 1), 0, 1);
  if (value > max) return clamp((value - max) / (max || 1), 0, 1);
  return 0;
}

function getObj(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null;
}

function getNum(obj: JsonObject | null, key: string): number | null {
  if (!obj) return null;
  const v = obj[key];
  return isFiniteNumber(v) ? v : null;
}

export type MixScores = {
  overall_score: number | null;
  sub_clarity: number | null;
  hi_end: number | null;
  dynamics: number | null;
  stereo_image: number | null;
  tonality: number | null;
};

export function computeMixScores(args: {
  lufs: number | null;
  lra: number | null;
  samplePeakDb: number | null;
  spectralCentroidHz: number | null;
  spectralRolloffHz: number | null;
  spectralFlatness: number | null;
  stereoWidth: number | null;
  bandsNorm: BandsNorm;
  modelMatchPercent: number | null;
}): MixScores {
  const {
    lufs,
    lra,
    samplePeakDb,
    spectralCentroidHz,
    spectralRolloffHz,
    spectralFlatness,
    stereoWidth,
    bandsNorm,
    modelMatchPercent,
  } = args;

  // Richiediamo un minimo di segnali, altrimenti null
  const hasAny =
    isFiniteNumber(lufs) ||
    isFiniteNumber(lra) ||
    isFiniteNumber(spectralCentroidHz) ||
    isFiniteNumber(stereoWidth) ||
    (bandsNorm && Object.keys(bandsNorm).length > 0) ||
    isFiniteNumber(modelMatchPercent);

  if (!hasAny) {
    return {
      overall_score: null,
      sub_clarity: null,
      hi_end: null,
      dynamics: null,
      stereo_image: null,
      tonality: null,
    };
  }

  // 1) sub_clarity: bilanciamento sub vs low e un pelo di flatness (rumore/sub muddiness)
  // Qui non stiamo stimando "bene/male assoluto", ma "quanto è centrato"
  const sub = isFiniteNumber(bandsNorm?.sub) ? bandsNorm.sub : null;
  const low = isFiniteNumber(bandsNorm?.low) ? bandsNorm.low : null;
  const lowmid = isFiniteNumber(bandsNorm?.lowmid) ? bandsNorm.lowmid : null;

  let subClarity: number | null = null;
  if (sub != null && low != null && lowmid != null) {
    // target: sub leggermente sotto low, lowmid non troppo alto
    const d1 = Math.abs((sub - low) - (-0.15)); // target sub-low = -0.15
    const d2 = Math.max(0, (lowmid - 0.55)); // se lowmid troppo alto, penalizza
    const flatPen = spectralFlatness != null ? penaltyOutside(spectralFlatness, 0.03, 0.18) : 0;

    const dist = clamp(d1 * 1.2 + d2 * 1.0 + flatPen * 0.6, 0, 1);
    subClarity = scoreFromDistance01(dist);
  }

  // 2) hi_end: presence/high/air coerenti e centroid non estremo
  const presence = isFiniteNumber(bandsNorm?.presence) ? bandsNorm.presence : null;
  const high = isFiniteNumber(bandsNorm?.high) ? bandsNorm.high : null;
  const air = isFiniteNumber(bandsNorm?.air) ? bandsNorm.air : null;

  let hiEnd: number | null = null;
  if ((presence != null && high != null && air != null) || spectralCentroidHz != null) {
    const centroidPen =
      spectralCentroidHz != null ? penaltyOutside(spectralCentroidHz, 1800, 4200) : 0;

    let bandDist = 0;
    let bandCount = 0;

    if (presence != null && high != null) {
      bandDist += Math.abs((high - presence) - (-0.05)); // high leggermente sotto presence
      bandCount += 1;
    }
    if (air != null && high != null) {
      bandDist += Math.abs((air - high) - (-0.08)); // air sotto high
      bandCount += 1;
    }

    const avgBandDist = bandCount ? bandDist / bandCount : 0.25;
    const dist = clamp(avgBandDist * 1.4 + centroidPen * 0.8, 0, 1);
    hiEnd = scoreFromDistance01(dist);
  }

  // 3) dynamics: LRA + sample peak (se esiste) + LUFS (troppo spinto penalizza)
  let dynamics: number | null = null;
  if (lra != null || samplePeakDb != null || lufs != null) {
    const lraPen = lra != null ? penaltyOutside(lra, 4, 14) : 0; // range ragionevole
    const peakPen = samplePeakDb != null ? penaltyOutside(samplePeakDb, -9, -0.2) : 0; // se troppo basso è strano, se troppo alto clip
    const lufsPen = lufs != null ? penaltyOutside(lufs, -14.5, -7.0) : 0; // range master generico
    const dist = clamp(lraPen * 0.9 + peakPen * 0.6 + lufsPen * 0.8, 0, 1);
    dynamics = scoreFromDistance01(dist);
  }

  // 4) stereo_image: stereoWidth non troppo mono
  let stereoImage: number | null = null;
  if (stereoWidth != null) {
    // stereo_width nel tuo payload sembra molto basso (0.0056). Target minimo per non essere mono
    const pen = penaltyOutside(stereoWidth, 0.02, 0.35);
    stereoImage = scoreFromDistance01(clamp(pen * 1.2, 0, 1));
  }

  // 5) tonality: flatness + rolloff coerente
  let tonality: number | null = null;
  if (spectralFlatness != null || spectralRolloffHz != null) {
    const flatPen = spectralFlatness != null ? penaltyOutside(spectralFlatness, 0.03, 0.20) : 0;
    const rollPen = spectralRolloffHz != null ? penaltyOutside(spectralRolloffHz, 1500, 8000) : 0;
    const dist = clamp(flatPen * 1.0 + rollPen * 0.6, 0, 1);
    tonality = scoreFromDistance01(dist);
  }

  // overall_score: mix dei sotto-score disponibili + model match come stabilizzatore leggero
  const parts: Array<{ v: number | null; w: number }> = [
    { v: subClarity, w: 1.1 },
    { v: hiEnd, w: 1.0 },
    { v: dynamics, w: 1.0 },
    { v: stereoImage, w: 0.8 },
    { v: tonality, w: 0.9 },
  ];

  let sumW = 0;
  let sum = 0;
  for (const p of parts) {
    if (p.v == null) continue;
    sumW += p.w;
    sum += p.v * p.w;
  }

  let overall: number | null = null;
  if (sumW > 0) {
    overall = Math.round(sum / sumW);
    if (modelMatchPercent != null) {
      // aggiusta leggermente verso la coerenza col modello
      overall = Math.round(lerp(overall, clamp(modelMatchPercent, 0, 100), 0.25));
    }
    overall = clamp(overall, 0, 100);
  }

  return {
    overall_score: overall,
    sub_clarity: subClarity,
    hi_end: hiEnd,
    dynamics,
    stereo_image: stereoImage,
    tonality,
  };
}
