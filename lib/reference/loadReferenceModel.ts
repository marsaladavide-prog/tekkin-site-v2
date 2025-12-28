import fs from "node:fs/promises";
import path from "node:path";
import type { GenreReference } from "@/lib/reference/types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function unwrap(parsed: unknown): unknown {
  if (!isRecord(parsed)) return parsed;

  const candidates = [
    parsed,
    isRecord(parsed.model) ? parsed.model : null,
    isRecord(parsed.reference) ? parsed.reference : null,
    isRecord(parsed.data) ? parsed.data : null,
    isRecord(parsed.payload) ? parsed.payload : null,
    isRecord(parsed.reference_model) ? parsed.reference_model : null,
  ].filter(Boolean) as Record<string, unknown>[];

  // primo oggetto che sembra avere roba utile
  for (const c of candidates) {
    const hasBands =
      isRecord(c.bands_norm_percentiles) || isRecord(c.bands_norm) || isRecord(c.bandsNorm);
    const hasSpectrum =
      isRecord(c.spectrum_db) || isRecord(c.spectrum_ref) || isRecord(c.spectrumDb) || isRecord(c.spectrumRef);
    const hasStereo =
      isRecord(c.stereo_percentiles) || isRecord(c.stereoPercentiles);

    if (hasBands || hasSpectrum || hasStereo) return c;
  }

  return parsed;
}

function softLooksUsable(v: unknown): v is GenreReference {
  if (!isRecord(v)) return false;

  // NON richiedere tutto. Basta che ci sia almeno uno tra questi blocchi.
  const hasBands =
    isRecord(v.bands_norm_percentiles) || isRecord((v as any).bandsNormPercentiles) || isRecord((v as any).bands_norm);
  const hasSpectrum =
    isRecord((v as any).spectrum_db) || isRecord((v as any).spectrum_ref);
  const hasFeatures =
    isRecord((v as any).features_percentiles) || isRecord((v as any).loudness_percentiles);
  const hasStereo =
    isRecord((v as any).stereo_percentiles);

  return hasBands || hasSpectrum || hasFeatures || hasStereo;
}

export async function loadReferenceModel(profileKey: string): Promise<GenreReference | null> {
  if (!profileKey || !profileKey.trim()) return null;
  const clean = profileKey.trim();

  const candidates = [
    path.join(process.cwd(), "reference_models_v3", `${clean}.json`),
    path.join(process.cwd(), "reference_models", `${clean}.json`),
  ];

  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, "utf8");
      const parsed: unknown = JSON.parse(raw);
      const model = unwrap(parsed);

      if (!softLooksUsable(model)) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[loadReferenceModel] Unusable reference model: ${clean} (${p})`, {
            topKeys: isRecord(model) ? Object.keys(model) : null,
          });
        }
        continue; // IMPORTANT: prova l'altro path
      }

      return model as GenreReference;
    } catch {
      // prova il prossimo path
    }
  }

  return null;
}
