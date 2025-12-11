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

export type ModelMatch = {
  band_rmse: number | null;
  spec_rmse: number | null;
  loudness_diff: number | null;
  bpm_diff: number | null;
  distance: number | null;
  match_percent: number | null;
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
  reference_db?: any;
  model_match?: ModelMatch | null;
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

export type AnalyzerConfidence = {
  bpm?: number | null;
  key?: number | null;
  lufs?: number | null;
  spectral?: number | null;
  stereo?: number | null;
  mix_health?: number | null;
};

export type AnalyzerWarningSeverity = "info" | "warning" | "error";

export type AnalyzerWarning = {
  code: string;
  message: string;
  severity: AnalyzerWarningSeverity;
};

export type AnalyzerSpectrumDetails = {
  spectral_centroid_hz: number;
  spectral_rolloff_hz: number;
  spectral_bandwidth_hz: number;
  spectral_flatness: number;
  zero_crossing_rate: number;
  low_db: number;
  lowmid_db: number;
  mid_db: number;
  high_db: number;
  air_db: number;
};

export type HarmonicBalanceReport = {
  tilt_db: number;
  low_end_definition: number;
  hi_end_harshness: number;
};

export type StereoWidthInfo = {
  is_mono: boolean;
  global_correlation: number;
  lr_balance_db: number;
  band_widths_db: Record<"low" | "mid" | "high", number>;
};

export type AnalyzerResult = {
  version_id: string;
  project_id: string;

  // metri principali
  lufs: number;
  overall_score: number;
  feedback: string;

  // campi aggiuntivi che il Python sta già mandando
  sub_clarity: number | null;
  hi_end: number | null;
  dynamics: number | null;
  stereo_image: number | null;
  tonality: string | null;

  // suggerimenti + reference AI
  fix_suggestions: FixSuggestion[] | null;
  reference_ai?: ReferenceAi | null;

  // extra analisi v4
  bpm: number | null;
  spectral_centroid_hz: number | null;
  spectral_rolloff_hz: number | null;
  spectral_bandwidth_hz: number | null;
  spectral_flatness: number | null;
  zero_crossing_rate: number | null;
  key?: string | null;

  // Tekkin Analyzer V1
  mix_v1?: AnalyzerV1Result | null;
  spectral?: AnalyzerSpectrumDetails | null;
  confidence?: AnalyzerConfidence | null;
  warnings?: AnalyzerWarning[] | null;
  harmonic_balance?: HarmonicBalanceReport | null;
  stereo_width?: StereoWidthInfo | null;
  mix_health_score?: number | null;
};

export type AnalyzerRunResponse = {
  ok: boolean;
  version: {
    id: string;
    version_name: string;
  };
  analyzer_result: AnalyzerResult;
};

export type Priority = "low" | "medium" | "high";

export type IssueCategory =
  | "loudness"
  | "mix_balance"
  | "spectrum"
  | "stereo"
  | "structure"
  | "vocal"
  | "bass"
  | "drums";

export type LoudnessMetrics = {
  integrated_lufs: number;
  short_term_min: number;
  short_term_max: number;
  true_peak_db: number;
  crest_factor_db: number;
};

export type StemsBalanceMetrics = {
  kick_db?: number | null;
  bass_db?: number | null;
  drums_db?: number | null;
  vocal_db?: number | null;
  kick_vs_bass_db?: number | null;
  clap_vs_kick_db?: number | null;
  vocal_vs_mix_db?: number | null;
  bass_vs_mix_low_db?: number | null;
};

export type SpectrumMetrics = {
  low_db: number;
  lowmid_db: number;
  mid_db: number;
  high_db: number;
  air_db: number;
  deviation_from_reference_db: Record<string, number>;
};

export type StereoMetrics = {
  global_correlation: number;
  low_side_mid_db: number;
  mid_side_mid_db: number;
  high_side_mid_db: number;
};

export type StructureSectionType =
  | "intro"
  | "build"
  | "drop"
  | "break"
  | "outro"
  | "other";

export type StructureSection = {
  type: StructureSectionType;
  start_bar: number;
  end_bar: number;
};

export type StructureMetrics = {
  bpm: number;
  bars_total: number;
  sections: StructureSection[];
};

export type AnalyzerIssue = {
  category: IssueCategory;
  priority: Priority;
  issue: string;
  analysis: string;
  suggestion: string;
};

export type AnalyzerV1Metrics = {
  loudness: LoudnessMetrics;
  stems_balance: StemsBalanceMetrics;
  spectrum: SpectrumMetrics;
  stereo: StereoMetrics;
  structure: StructureMetrics;
};

export type AnalyzerV1Result = {
  version: string;
  profile: string;
  metrics: AnalyzerV1Metrics;
  issues: AnalyzerIssue[];
};

// ---- TEKKIN AI COACH ----

export type AnalyzerAiFocusArea =
  | "loudness"
  | "sub"
  | "lowmid"
  | "mid"
  | "high"
  | "stereo"
  | "stereo_high"
  | "vocals"
  | "hihats"
  | "percussions"
  | "transients"
  | "punch"
  | "structure"
  | "groove"
  | "arrangement"
  | "other";

export type AnalyzerAiPriority = "low" | "medium" | "high";

export type AnalyzerAiAction = {
  title: string;
  description: string;
  focus_area: AnalyzerAiFocusArea;
  priority: AnalyzerAiPriority;
};

export type AnalyzerAiMeta = {
  artistic_assessment: string;
  risk_flags: string[];
  predicted_rank_gain: number | null;
  label_fit: string | null;
  structure_feedback: string | null;
};

export type AnalyzerAiCoach = {
  summary: string;
  actions: AnalyzerAiAction[];
  meta: AnalyzerAiMeta;
};
