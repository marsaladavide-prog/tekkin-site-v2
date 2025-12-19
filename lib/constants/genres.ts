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

export function formatGenreLabel(value: unknown) {
  // Defensive: callers might pass objects (eg. TekkinGenreOption) or non-strings.
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "id" in value
        ? String((value as any).id)
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
      : input && typeof input === "object" && "id" in input
        ? String((input as any).id)
        : String(input);

  if (!id) return null;
  const match = TEKKIN_GENRES.find((genre) => genre.id === id);
  return match ? match.label : formatGenreLabel(id);
}

export const TEKKIN_MIX_TYPES = ["premaster", "master"] as const;
export type TekkinMixType = (typeof TEKKIN_MIX_TYPES)[number];
