import type {
  AnalyzerCompareModel,
  Bands,
  BandsPercentiles,
  SpectrumPoint,
  Spectral,
  ReferenceSpectralPercentiles,
  ReferenceStereoPercentiles,
} from "@/lib/analyzer/v2/types";
import type { GenreReference } from "@/lib/reference/types";
import type { RefState } from "./refState";

export type ReferenceModelLike = GenreReference & Record<string, unknown>;

export type VersionRowLike = {
  id: string;
  analyzer_json?: Record<string, unknown> | null;
  analyzer_arrays?: Record<string, unknown> | null;
  analyzer_profile_key?: string | null;
  reference_model_key?: string | null;
  reference_bands_norm?: Record<string, unknown> | null;
  analyzer_bands_norm?: Record<string, unknown> | null;
  analyzer_bpm?: number | null;
  analyzer_key?: string | null;
  analyzer_spectral_centroid_hz?: number | null;
  analyzer_spectral_rolloff_hz?: number | null;
  analyzer_spectral_bandwidth_hz?: number | null;
  analyzer_spectral_flatness?: number | null;
  analyzer_zero_crossing_rate?: number | null;
  analyzer_arrays_blob?: Record<string, unknown> | null;
  project?: { title?: string | null } | { title?: string | null }[];
  version_name?: string | null;
  mix_type?: AnalyzerCompareModel["mixType"] | null;
  [key: string]: unknown;
};

export type AnalyzerCardsModel = {
  versionId: string;
  profileKey: string | null;
  lang: "it" | "en";
  analyzer: AnalyzerCompareModel;
  referenceModel?: ReferenceModelLike | null;
  computed: {
    refStates: Record<
      "tonal" | "spectrum" | "loudness" | "rhythm" | "stereo" | "transients",
      RefState
    >;
    tonal: {
      trackBands?: Bands | null;
    referencePercentiles?: BandsPercentiles | null;
    referenceName?: string | null;
    lang: "it" | "en";
  };
  spectrum: {
    track?: SpectrumPoint[] | null;
    reference?: SpectrumPoint[] | null;
    spectral?: Spectral | null;
    referenceSpectralPercentiles?: ReferenceSpectralPercentiles | null;
  };
    stereo: {
      width?: number | null;
      widthPercentiles?: ReferenceStereoPercentiles["stereoWidth"] | null;
      correlation?: number | null;
      correlationPercentiles?: ReferenceStereoPercentiles["lrCorrelation"] | null;
      soundFieldXY?: { x: number; y: number }[] | null;
      referenceSoundFieldXY?: { x: number; y: number }[] | null;
      widthByBand?: AnalyzerCompareModel["widthByBand"] | null;
    };
    transients: {
      transients?: AnalyzerCompareModel["transients"] | null;
      referencePercentiles?: AnalyzerCompareModel["referenceTransientsPercentiles"] | null;
      referenceName?: string | null;
    };
    extra: {
      mfccMean?: number[] | null;
      hfc?: number | null;
      spectralPeaksCount?: number | null;
      spectralPeaksEnergy?: number | null;
    };
  };
};
