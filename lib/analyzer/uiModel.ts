import type { AnalyzerReadyLevel } from "@/lib/analyzer/getAnalyzerAvailability";

export type AnalyzerReadiness = "needs_work" | "good" | "strong";
export type AnalyzerInsightSeverity = "high" | "med";

export type AnalyzerInsight = {
  title: string;
  body: string;
  severity?: AnalyzerInsightSeverity;
};

export type AnalyzerCta = {
  label: string;
  href?: string;
  actionId?: "run_analysis" | "go_project" | "upgrade_to_pro";
};

export type AnalyzerCriticalSignal = {
  title: string;
  impact: string;
  whyItMatters: string;
  severity: AnalyzerInsightSeverity;
};

export type AnalyzerPositioning = {
  headline: string;
  detail: string;
  badge?: string;
};

export type AnalyzerBreakdownBlock = {
  title: string;
  description?: string;
  kind: "legacy_quick" | "legacy_pro";
};

export type AnalyzerUiModel = {
  readyLevel: AnalyzerReadyLevel;
  heroLine: string;
  readiness: AnalyzerReadiness;
  readinessLabel: string;
  insights: AnalyzerInsight[];
  cta: AnalyzerCta;

  criticalSignals?: AnalyzerCriticalSignal[];
  positioning?: AnalyzerPositioning;
  breakdown?: AnalyzerBreakdownBlock[];
  showPro?: boolean;
  metrics?: {
    score?: number | null;        // 0-100
    bpm?: number | null;
    key?: string | null;
    lufs?: number | null;
    matchPercent?: number | null; // 0-100
    profileLabel?: string | null;
  };
};
