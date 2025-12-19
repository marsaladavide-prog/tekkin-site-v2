export type Bands = {
  sub?: number;
  low?: number;
  lowmid?: number;
  mid?: number;
  presence?: number;
  high?: number;
  air?: number;
};

export type Spectral = {
  spectral_centroid_hz?: number | null;
  spectral_bandwidth_hz?: number | null;
  spectral_flatness?: number | null;
  zero_crossing_rate?: number | null;
  spectral_rolloff_hz?: number | null;
};

export type Loudness = {
  integrated_lufs?: number | null;
  lra?: number | null;
  sample_peak_db?: number | null; // per ora sample o true peak, vedi adapter
  rms_db?: number | null;
};

export type AnalyzerCompareModel = {
  projectTitle: string;
  versionName: string;
  mixType: "MASTER" | "PREMASTER" | "ALT_MIX";
  bpm?: number | null;
  key?: string | null;
  overallScore?: number | null;

  bandsNorm?: Bands | null;
  spectral?: Spectral | null;
  loudness?: Loudness | null;

  referenceName?: string | null;
  referenceBandsNorm?: Bands | null;

  spectrumTrack?: { hz: number; mag: number }[] | null;
  spectrumRef?: { hz: number; mag: number }[] | null;

  soundField?: { angleDeg: number; radius: number }[] | null;

  levels?: {
    label: "L" | "C" | "R" | "Ls" | "Rs" | "LFE";
    rmsDb: number;
    peakDb: number;
  }[] | null;
};
