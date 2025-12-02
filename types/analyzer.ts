export type FixSuggestion = {
  issue: string;
  priority: "low" | "medium" | "high" | string;
  analysis: string;
  steps: string[];
};

export type ReferenceAiBandStatus = {
  value: number;
  target_min: number;
  target_max: number;
  status: string;
};

export type ReferenceAi = {
  profile_key: string;
  profile_label: string;
  match_ratio: number;
  bands_in_target: number;
  bands_total: number;
  lufs_in_target: boolean;
  crest_in_target: boolean;
  tone_tag: string;
  bands_status: Record<string, ReferenceAiBandStatus>;
  reference_db?: { error?: string } | null;
};

export type AnalyzerMetricsFields = {
  lufs?: number | null;
  overall_score?: number | null;
  feedback?: string | null;
  sub_clarity?: number | null;
  hi_end?: number | null;
  dynamics?: number | null;
  stereo_image?: number | null;
  tonality?: string | null;
  analyzer_bpm?: number | null;
  analyzer_spectral_centroid_hz?: number | null;
  analyzer_spectral_rolloff_hz?: number | null;
  analyzer_spectral_bandwidth_hz?: number | null;
  analyzer_spectral_flatness?: number | null;
  analyzer_zero_crossing_rate?: number | null;
  fix_suggestions?: FixSuggestion[] | null;
  reference_ai?: ReferenceAi | null;
};

export type AnalyzerResult = {
  version_id: string;
  project_id: string;
  lufs: number;
  overall_score: number;
  feedback: string;
  fix_suggestions: FixSuggestion[] | null;
  reference_ai?: ReferenceAi | null;
  bpm: number | null;
  spectral_centroid_hz: number | null;
  spectral_rolloff_hz: number | null;
  spectral_bandwidth_hz: number | null;
  spectral_flatness: number | null;
  zero_crossing_rate: number | null;
};

export type AnalyzerRunResponse = {
  ok: boolean;
  version: {
    id: string;
    version_name: string;
  };
  analyzer_result: AnalyzerResult;
};
