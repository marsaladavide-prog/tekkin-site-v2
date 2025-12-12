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

export interface ReferenceAiInsights {
  profile_key: string;
  profile_label: string;
  match_ratio: number;
  bands_in_target: number;
  bands_total: number;
  lufs_in_target: boolean;
  bands_status: Record<string, {
    value: number;
    target_min: number;
    target_max: number;
    status: 'low' | 'in_target' | 'high';
  }>;
  adjustments: ReferenceAiAdjustment;
  warnings: WarningMessage[];
  debug?: ReferenceAiDebug;
}

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

export interface AnalyzerResult {
  version_id: string;
  project_id: string;
  overall_score: number;
  mix_health_score: number;
  lufs: number;
  bpm: number;
  key: string;
  confidence: AnalysisProConfidence;
  spectral_centroid_hz: number;
  spectral_rolloff_hz: number;
  spectral_bandwidth_hz: number;
  spectral_flatness: number;
  zero_crossing_rate: number;
  feedback: string;
  fix_suggestions: FixSuggestion[];
  warnings: WarningMessage[];
  reference_ai: ReferenceAiInsights;
  analysis_pro?: AnalysisProInsights | null;
}

// ❌ Legacy types rimossi: tonality, stereo_image, sub_clarity, hi_end, reference_db, model_match
