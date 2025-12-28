import fs from "node:fs/promises";
import path from "node:path";
import type { GenreReference, BandKey } from "@/lib/reference/types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isBandKey(v: unknown): v is BandKey {
  return (
    v === "sub" ||
    v === "low" ||
    v === "lowmid" ||
    v === "mid" ||
    v === "presence" ||
    v === "high" ||
    v === "air"
  );
}

/**
 * Guard pragmatica:
 * controlliamo solo i campi che servono davvero a UI / analyzer.
 * Se questi esistono, il modello è utilizzabile.
 */
function isGenreReference(v: unknown): v is GenreReference {
  if (!isRecord(v)) return false;

  if (typeof v.profile_key !== "string") return false;
  if (typeof v.sr !== "number") return false;
  if (!Array.isArray(v.bands_schema)) return false;

  for (const b of v.bands_schema) {
    if (!isRecord(b)) return false;
    if (!isBandKey(b.key)) return false;
    if (typeof b.fmin !== "number") return false;
    if (typeof b.fmax !== "number") return false;
  }

  if (!isRecord(v.bands_norm_stats)) return false;
  if (!isRecord(v.bands_norm_percentiles)) return false;

  return true;
}

export async function loadReferenceModel(
  profileKey: string
): Promise<GenreReference | null> {
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

      if (!isGenreReference(parsed)) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[loadReferenceModel] Invalid reference model shape: ${clean} (${p})`
          );
        }
        return null;
      }

      return parsed;
    } catch {
      // prova il prossimo path
    }
  }

  return null;
}
