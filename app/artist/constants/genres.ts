// app/artist/constants/genres.ts
export const TEKKIN_GENRES = [
  "house",
  "deep_house",
  "funky_house",
  "soulful_house",
  "jackin_house",
  "progressive_house",
  "afro_house",
  "organic_house",
  "piano_house",

  "tech_house",
  "peak_time_tech_house",
  "bass_house",
  "tribal_tech_house",
  "minimal_deep_tech",

  "minimal_house",
  "micro_house",
  "minimal_techno",
] as const;

export type TekkinGenre = (typeof TEKKIN_GENRES)[number];

export function formatGenreLabel(value: TekkinGenre | string) {
  // house → House
  // deep_house → Deep House
  const pretty = value.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}
