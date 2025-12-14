import fs from "node:fs/promises";
import path from "node:path";
import type { GenreReference } from "./types";

export async function loadGenreReference(profileKey: string): Promise<GenreReference> {
  const file = path.join(process.cwd(), "reference_models", `${profileKey}.json`);
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as GenreReference;
}
