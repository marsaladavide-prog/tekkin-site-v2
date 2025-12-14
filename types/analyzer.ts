/* Pulizia types/analyzer.ts per nuova struttura Essentia-centric */

// ✅ Conservati
export interface FixSuggestion {
  issue: string;
  priority: 'low' | 'medium' | 'high';
  analysis: string;
  steps: string[];
}

export interface WarningMessage {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface ReferenceAiAdjustment {
  raw_diffs: Record<string, number | null>;
  suggestions: string[];
}

export interface ReferenceAiDebug {
  essentia_values: Record<string, number | string | number[]>;
}

export interface ReferenceAiBandStatus {
  value: number | null;
  target_min: number | null;
  target_max: number | null;
  status: 'low' | 'in_target' | 'high' | string;
}

export interface AnalyzerReferenceAi {
  match_ratio?: number | null;
  bands_status: Record<string, ReferenceAiBandStatus> | null;
  adjustments: ReferenceAiAdjustment | null;
  debug: ReferenceAiDebug | null;
}

export interface ReferenceAi extends AnalyzerReferenceAi {
  profile_key?: string | null;
  profile_label?: string | null;
  bands_in_target?: number | null;
  bands_total?: number | null;
  lufs_in_target?: boolean | null;
  crest_in_target?: boolean | null;
  tone_tag?: string | null;
  warnings?: WarningMessage[] | null;
  match_ratio?: number | null;
}

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

export type AnalyzerWarningSeverity = 'info' | 'warning' | 'error';

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
  band_widths_db: Record<'low' | 'mid' | 'high', number>;
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

// ---- TEKKIN AI COACH ----

export type AnalyzerAiFocusArea =
  | 'loudness'
  | 'sub'
  | 'lowmid'
  | 'mid'
  | 'high'
  | 'stereo'
  | 'stereo_high'
  | 'vocals'
  | 'hihats'
  | 'percussions'
  | 'transients'
  | 'punch'
  | 'structure'
  | 'groove'
  | 'arrangement'
  | 'other';

export type AnalyzerAiPriority = 'low' | 'medium' | 'high';

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

export type AnalyzerRunResponse = {
  ok: boolean;
  version: {
    id: string;
    version_name: string;
  };
  analyzer_result: AnalyzerResult;
};

export type Priority = 'low' | 'medium' | 'high';

export type IssueCategory =
  | 'loudness'
  | 'mix_balance'
  | 'spectrum'
  | 'stereo'
  | 'structure'
  | 'vocal'
  | 'bass'
  | 'drums';

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
  | 'intro'
  | 'build'
  | 'drop'
  | 'break'
  | 'outro'
  | 'other';

export type StructureSection = {
  type: StructureSectionType;
  start_bar: number;
  end_bar: number;
};

export type StructureMetrics = {
  bars_total: number;
  sections: StructureSection[];
};

export interface AnalysisProRhythm {
  bpm: number;
  confidence: number;
  beats?: any;
  tempo_curve?: any;
}

export interface AnalysisProTonal {
  key: string;
  scale: string;
  key_confidence: number;
  tonal_strength: number;
}

export interface AnalysisProLoudness {
  integrated_lufs: number;
  lra: number;
  momentary_loudness: number;
  short_term_loudness: number;
  true_peak_db: number;
}

export interface AnalysisProSpectral {
  centroid_hz: number;
  rolloff_hz: number;
  bandwidth_hz: number;
  flatness: number;
  mfcc_mean: number[];
  mfcc_std: number[];
  low_db: number;
  lowmid_db: number;
  mid_db: number;
  high_db: number;
  air_db: number;
  zero_crossing_rate: number;
}

export interface AnalysisProStereo {
  global_correlation: number;
  lr_balance_db: number;
  is_mono: boolean;
  band_widths_db: {
    low: number;
    mid: number;
    high: number;
  };
}

export interface AnalysisProConfidence {
  bpm: number;
  key: number;
  lufs: number;
  spectral: number;
  stereo: number;
  mix_health: number;
}

export interface AnalysisProInsights {
  rhythm: AnalysisProRhythm;
  tonal: AnalysisProTonal;
  loudness: AnalysisProLoudness;
  spectral: AnalysisProSpectral;
  stereo: AnalysisProStereo;
  confidence: AnalysisProConfidence;
}

export interface LoudnessArrayStats {
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
}

export interface LoudnessStats {
  integrated_lufs: number | null;
  lra: number | null;
  true_peak_db: number | null;
  short_term_lufs?: number[] | null;
  momentary_lufs?: number[] | null;
  short_term_stats?: LoudnessArrayStats | null;
  momentary_stats?: LoudnessArrayStats | null;
  short_lufs_min?: number | null;
  short_lufs_max?: number | null;
  short_lufs_std?: number | null;
  short_lufs_mean?: number | null;
}

export interface AnalyzerResult {
  version_id: string;
  project_id: string;
  overall_score: number | null;
  mix_health_score: number | null;
  lufs: number | null;
  bpm: number | null;
  key: string | null;
  confidence: AnalysisProConfidence;
  spectral_centroid_hz: number | null;
  spectral_rolloff_hz: number | null;
  spectral_bandwidth_hz: number | null;
  spectral_flatness: number | null;
  zero_crossing_rate: number | null;
  feedback: string | null;
  fix_suggestions: FixSuggestion[];
  warnings: WarningMessage[];
  reference_ai: AnalyzerReferenceAi | null;
  analysis_pro?: AnalysisProInsights | null;
  analysis_scope?: string | null;
  dynamics?: number | null;
  harmonic_balance?: HarmonicBalanceReport | null;
  stereo_width?: StereoWidthInfo | null;
  loudness_stats?: LoudnessStats | null;
  arrays_blob_path?: string | null;
  arrays_blob_size_bytes?: number | null;
}

// ❌ Legacy types rimossi: tonality, stereo_image, sub_clarity, hi_end, reference_db, model_match
