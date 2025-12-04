const TEKKIN_GENRE_IDS = [
  "minimal_deep_tech",
  "tech_house",
  "house",
  "deep_house",
  "funky_house",
  "soulful_house",
  "jackin_house",
  "progressive_house",
  "afro_house",
  "organic_house",
  "piano_house",
  "peak_time_tech_house",
  "bass_house",
  "tribal_tech_house",
  "minimal_house",
  "micro_house",
  "minimal_techno",
  "other",
] as const;

export type TekkinGenreId = (typeof TEKKIN_GENRE_IDS)[number];

const GENRE_LABEL_OVERRIDES: Record<TekkinGenreId, string> = {
  minimal_deep_tech: "Minimal / Deep Tech",
  tech_house: "Tech House",
  house: "House",
  other: "Altro",
  deep_house: "Deep House",
  funky_house: "Funky House",
  soulful_house: "Soulful House",
  jackin_house: "Jackin House",
  progressive_house: "Progressive House",
  afro_house: "Afro House",
  organic_house: "Organic House",
  piano_house: "Piano House",
  peak_time_tech_house: "Peak Time Tech House",
  bass_house: "Bass House",
  tribal_tech_house: "Tribal Tech House",
  minimal_house: "Minimal House",
  micro_house: "Micro House",
  minimal_techno: "Minimal Techno",
};

export type TekkinGenreOption = {
  id: TekkinGenreId;
  label: string;
};

export const TEKKIN_GENRES = TEKKIN_GENRE_IDS.map(
  (id): TekkinGenreOption => ({
    id,
    label: GENRE_LABEL_OVERRIDES[id] ?? formatGenreLabel(id),
  })
) as const;

export function formatGenreLabel(value: string) {
  const pretty = value.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export function getTekkinGenreLabel(id?: string | null): string | null {
  if (!id) return null;
  const match = TEKKIN_GENRES.find((genre) => genre.id === id);
  return match ? match.label : formatGenreLabel(id);
}

export const TEKKIN_MIX_TYPES = ["premaster", "master"] as const;
export type TekkinMixType = (typeof TEKKIN_MIX_TYPES)[number];
