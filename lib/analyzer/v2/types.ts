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

export type Loudness = {
  integrated_lufs?: number | null;
  lra?: number | null;
  sample_peak_db?: number | null;
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
};
