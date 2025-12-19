import fs from "fs/promises";
import path from "path";

export async function loadReferenceModel(referenceModelKey: string) {
  if (!referenceModelKey) return null;

  const safeKey = referenceModelKey
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  const filePath = path.join(
    process.cwd(),
    "reference_models",
    `${safeKey}.json`
  );

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    console.error(
      "[reference] model not found:",
      referenceModelKey,
      "->",
      filePath
    );
    return null;
  }
}
