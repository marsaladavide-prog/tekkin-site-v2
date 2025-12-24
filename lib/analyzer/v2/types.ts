export type Bands = {
  sub?: number;
  low?: number;
  lowmid?: number;
  mid?: number;
  presence?: number;
  high?: number;
  air?: number;
};

export type BandsPercentiles = {
  [K in keyof Bands]?: {
    p10?: number;
    p25?: number;
    p50?: number;
    p75?: number;
    p90?: number;
  };
};

export type PercentileRange = {
  p10?: number;
  p50?: number;
  p90?: number;
};

export type PercentileRange3 = {
  p10?: number | null;
  p50?: number | null;
  p90?: number | null;
};

export type ReferenceStereoPercentiles = {
  lrBalanceDb?: PercentileRange;
  lrCorrelation?: PercentileRange;
};

export type Spectral = {
  spectral_centroid_hz?: number | null;
  spectral_rolloff_hz?: number | null;
  spectral_flatness?: number | null;
  spectral_bandwidth_hz?: number | null;
  zero_crossing_rate?: number | null;
};

export type LoudnessSection = {
  seconds?: number | null;
  mean_short_term_lufs?: number | null;
  min_short_term_lufs?: number | null;
  max_short_term_lufs?: number | null;
};

export type LoudnessSections = {
  thresholds?: { p30?: number | null; p70?: number | null } | null;
  intro?: LoudnessSection | null;
  drop?: LoudnessSection | null;
  break?: LoudnessSection | null;
  outro?: LoudnessSection | null;
};

export type Loudness = {
  integrated_lufs?: number | null;
  lra?: number | null;
  sample_peak_db?: number | null;
  true_peak_db?: number | null;
  true_peak_method?: string | null;

  momentary_percentiles?: PercentileRange3 | null;
  short_term_percentiles?: PercentileRange3 | null;
  sections?: LoudnessSections | null;
};

export type SpectrumPoint = { hz: number; mag: number };

export type SoundField = {
  radius: number[];
  angle_deg: number[];
};

export type LevelMeter = {
  label: "L" | "C" | "R" | "Ls" | "Rs" | "LFE";
  rmsDb: number;
  peakDb: number;
};

export type Transients = {
  strength: number | null;
  density: number | null;
  crestFactorDb: number | null;
  log_attack_time?: number | null;
};

export type StereoSummary = Record<string, number>;

export type Rhythm = {
  relative_key?: string | null;
  danceability?: number | null;
  beat_times?: number[] | null;
  descriptors?: Record<string, number> | null;
};

export type Extra = {
  mfcc_mean?: number[] | null;
  hfc?: number | null;
  spectral_peaks_count?: number | null;
  spectral_peaks_energy?: number | null;
};

export type AnalyzerCompareModel = {
  projectTitle: string;
  versionName: string;
  mixType: "MASTER" | "MIX" | "UNKNOWN";

  bpm: number | null;
  key: string | null;
  overallScore: number | null;

  bandsNorm: Bands | null;

  // reference model
  referenceName: string | null;
  referenceBandsNorm: Bands | null;
  referenceBandsPercentiles?: BandsPercentiles | null;
  referenceStereoPercentiles?: ReferenceStereoPercentiles | null;
  referenceFeaturesPercentiles?: {
    lufs?: PercentileRange | null;
  } | null;

  // spectrum overlay
  spectrumTrack: SpectrumPoint[] | null;
  spectrumRef: SpectrumPoint[] | null;

  // other metrics
  spectral: Spectral | null;
  loudness: Loudness | null;
  soundField: { angleDeg: number; radius: number }[] | null;
  levels: LevelMeter[] | null;
  transients?: Transients | null;

  momentaryLufs?: number[];
  shortTermLufs?: number[];

  // stereo
  stereoWidth?: number | null;
  widthByBand?: Bands | null;
  correlation?: number[] | null;
  stereoSummary?: StereoSummary | null;

  // rhythm
  rhythm?: Rhythm | null;

  // extra
  extra?: Extra | null;
};
