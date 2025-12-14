export type BandKey =
  | "sub"
  | "low"
  | "lowmid"
  | "mid"
  | "presence"
  | "high"
  | "air";

export type BandsNorm = Partial<Record<BandKey, number>>;

export type StatPair = { mean: number | null; std: number | null };
export type Percentiles = { p10: number | null; p50: number | null; p90: number | null };

export type GenreReference = {
  profile_key: string;
  samples_count: number;
  files_total: number;
  skipped: number;
  built_at: string;
  engine: string;
  sr: number;

  bands_schema: Array<{ key: BandKey; fmin: number; fmax: number }>;

  bands_norm_stats: Record<BandKey, StatPair>;
  bands_norm_percentiles: Record<BandKey, Percentiles>;

  features_stats: Record<string, StatPair>;
  features_percentiles: Record<string, Percentiles>;

  tracks_jsonl: string;
};
