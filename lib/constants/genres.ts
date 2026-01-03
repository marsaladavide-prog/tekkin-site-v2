const TEKKIN_GENRE_IDS = [
  "minimal_deep_tech",
  "tech_house",
  "house",
  "minimal_house",
  "other",
] as const;

export type TekkinGenreId = (typeof TEKKIN_GENRE_IDS)[number];

const GENRE_LABEL_OVERRIDES: Record<TekkinGenreId, string> = {
  minimal_deep_tech: "Minimal / Deep Tech",
  tech_house: "Tech House",
  house: "House",
  other: "Altro",
  minimal_house: "Minimal / House",
};

export type TekkinGenreOption = {
  id: TekkinGenreId;
  label: string;
};
export const TEKKIN_GENRES: TekkinGenreOption[] = TEKKIN_GENRE_IDS.map(
  (id): TekkinGenreOption => ({
    id,
    label: GENRE_LABEL_OVERRIDES[id] ?? formatGenreLabel(id),
  })
);

const TEKKIN_GENRE_ID_SET = new Set(TEKKIN_GENRE_IDS);
const LABEL_SANITIZER = /[^a-z0-9]/g;
const TEKKIN_GENRE_LABEL_LOOKUP = new Map<string, TekkinGenreId>();

function normalizeLabelForLookup(value: string) {
  return value.toLowerCase().replace(LABEL_SANITIZER, "");
}

for (const genre of TEKKIN_GENRES) {
  TEKKIN_GENRE_LABEL_LOOKUP.set(normalizeLabelForLookup(genre.label), genre.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function formatGenreLabel(value: unknown) {
  const raw =
    typeof value === "string"
      ? value
      : isRecord(value) && "id" in value
        ? String(value.id)
        : value == null
          ? ""
          : String(value);

  const safe = raw.trim();
  if (!safe) return "";
  const pretty = safe.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export function getTekkinGenreLabel(input?: unknown): string | null {
  if (input == null) return null;

  const id =
    typeof input === "string"
      ? input
      : isRecord(input) && "id" in input
        ? String(input.id)
        : String(input);

  if (!id) return null;
  const match = TEKKIN_GENRES.find((genre) => genre.id === id);
  return match ? match.label : formatGenreLabel(id);
}

function normalizeTekkinGenreId(value: unknown): TekkinGenreId | null {
  if (value == null) return null;
  const candidate =
    typeof value === "string"
      ? value
      : isRecord(value) && "id" in value
        ? String(value.id)
        : "";
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (TEKKIN_GENRE_ID_SET.has(trimmed as TekkinGenreId)) {
    return trimmed as TekkinGenreId;
  }
  const normalizedLabel = normalizeLabelForLookup(trimmed);
  return TEKKIN_GENRE_LABEL_LOOKUP.get(normalizedLabel) ?? null;
}

export function parseTekkinGenreIds(raw?: unknown): TekkinGenreId[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => normalizeTekkinGenreId(entry))
      .filter((entry): entry is TekkinGenreId => Boolean(entry));
  }
  const single = normalizeTekkinGenreId(raw);
  return single ? [single] : [];
}

export const TEKKIN_MIX_TYPES = ["premaster", "master"] as const;
export type TekkinMixType = (typeof TEKKIN_MIX_TYPES)[number];
