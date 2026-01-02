export type TekkinVersionRankComponentKey =
  | "tonal"
  | "loudness"
  | "spectral"
  | "stereo"
  | "transients"
  | "rhythm";

export interface TekkinVersionRankComponent {
  key: TekkinVersionRankComponentKey;
  label: string;
  description: string;
  weight: number;
  score: number | null;
  contribution: number | null;
  hasData: boolean;
  detailLines?: string[];
}

export interface TekkinVersionRankPenalty {
  key: string;
  label: string;
  amount: number;
  points: number;
  details: string;
}

export interface TekkinVersionRankPrecision {
  key: TekkinVersionRankComponentKey;
  label: string;
  closeness: number | null;
}

export interface TekkinVersionRankDetails {
  score: number;
  referenceFit: number | null;
  baseQuality: number | null;
  prePenaltyScore: number;
  components: TekkinVersionRankComponent[];
  penalties: TekkinVersionRankPenalty[];
  precisionBonus: number;
  precisionBreakdown: TekkinVersionRankPrecision[];
}
