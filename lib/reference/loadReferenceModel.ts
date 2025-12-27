import fs from "node:fs/promises";
import path from "node:path";

export async function loadReferenceModel(profileKey: string): Promise<any | null> {
  if (!profileKey || !profileKey.trim()) return null;

  const clean = profileKey.trim();

  // Priorità ai model v3 (completi). Fallback ai legacy.
  const candidates = [
    path.join(process.cwd(), "reference_models_v3", `${clean}.json`),
    path.join(process.cwd(), "reference_models", `${clean}.json`),
  ];

  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, "utf8");
      return JSON.parse(raw);
    } catch {
      // continua col prossimo candidato
    }
  }

  return null;
}
