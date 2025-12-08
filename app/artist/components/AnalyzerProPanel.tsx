"use client";

import { useMemo, useState } from "react";
import type {
  AnalyzerMetricsFields,
  AnalyzerResult,
  AnalyzerV1Result,
  AnalyzerWarning,
  FixSuggestion,
  ReferenceAi,
  AnalyzerAiAction,
  AnalyzerAiCoach,
  AnalyzerAiMeta,
} from "@/types/analyzer";

import type {
  TekkinReadiness,
  TekkinReadinessResult,
} from "@/lib/tekkinProfiles";

import { evaluateTekkinStatus } from "@/lib/tekkinProfiles";
import { AnalyzerOverviewSection } from "./AnalyzerOverviewSection";
import { TekkinAiPlanSection } from "./TekkinAiPlanSection";
import { AnalyzerDetailsSection } from "./AnalyzerDetailsSection";
import { AnalyzerLogsSection } from "./AnalyzerLogsSection";
import type { AnalyzerReadinessIntent } from "./AnalyzerReadinessTag";
import { getTekkinGenreLabel, TekkinGenreId } from "@/lib/constants/genres";
import {
  formatBpm,
  getBrightnessLabel,
  getMatchBucket,
  getMixState,
  getScoreLabel,
} from "./analyzerDisplayUtils";

const FIX_VISIBLE_LIMIT = 5;

type FixPriority = "low" | "medium" | "high";

const FIX_PRIORITY_ORDER: Record<FixPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function normalizeFixPriority(value?: string | null): FixPriority {
  const normalized = (value ?? "medium").toLowerCase();
  if (normalized === "high" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function sortFixSuggestions<T extends { priority?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aScore = FIX_PRIORITY_ORDER[normalizeFixPriority(a.priority)];
    const bScore = FIX_PRIORITY_ORDER[normalizeFixPriority(b.priority)];
    if (aScore !== bScore) return aScore - bScore;
    return 0;
  });
}

function getReferenceGenreLabel(ref?: ReferenceAi | null): string | null {
  if (!ref) return null;
  if (ref.profile_label) return ref.profile_label;

  if (ref.profile_key) {
    try {
      return getTekkinGenreLabel(ref.profile_key as TekkinGenreId) ?? ref.profile_key;
    } catch {
      return ref.profile_key;
    }
  }

  return null;
}

function getReferenceMatchPercent(ref?: ReferenceAi | null): number | null {
  if (!ref) return null;

  if (typeof ref.model_match?.match_percent === "number") {
    return Math.round(ref.model_match.match_percent);
  }

  if (typeof ref.match_ratio === "number") {
    return Math.round(ref.match_ratio * 100);
  }

  return null;
}

function TekkinGenreMatchCard({ referenceAi }: { referenceAi?: ReferenceAi | null }) {
  if (!referenceAi) return null;

  const label = getReferenceGenreLabel(referenceAi);
  const matchPercent = getReferenceMatchPercent(referenceAi);

  if (!label && matchPercent == null) return null;

  let matchTag: "weak" | "medium" | "strong" = "weak";
  if (matchPercent != null) {
    if (matchPercent >= 80) {
      matchTag = "strong";
    } else if (matchPercent >= 60) {
      matchTag = "medium";
    }
  }

  const tagLabel =
    matchTag === "strong"
      ? "Match forte"
      : matchTag === "medium"
      ? "Match medio"
      : "Match debole";

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs md:text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">
            Genere tecnico probabile
          </p>
          {label && (
            <p className="mt-1 text-sm font-semibold md:text-base text-white">
              {label}
            </p>
          )}
          <p className="mt-2 text-[11px] leading-snug text-white/70">
            Questo match è basato solo sul profilo Tekkin (bande, loudness,
            crest), non sui metadata né sul gusto musicale.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          {matchPercent != null && (
            <div className="text-right">
              <p className="text-xl font-bold leading-none md:text-2xl text-white">
                {matchPercent}%
              </p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">
                match
              </p>
            </div>
          )}
          <span className="mt-1 inline-flex rounded-full bg-black/40 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/70">
            {tagLabel}
          </span>
        </div>
      </div>
    </section>
  );
}

type ReadinessTag = {
  label: string;
  description: string;
  intent: AnalyzerReadinessIntent;
};

function computeReadinessTag(params: {
  lufs?: number | null;
  overallScore?: number | null;
  referenceAi?: ReferenceAi | null;
}): ReadinessTag {
  const { overallScore, referenceAi } = params;

  const score = overallScore ?? null;
  const matchRatio = referenceAi?.match_ratio ?? null;
  const lufsInTarget = referenceAi?.lufs_in_target ?? false;

  if (
    score !== null &&
    score >= 7.5 &&
    matchRatio !== null &&
    matchRatio >= 0.75 &&
    lufsInTarget
  ) {
    return {
      label: "Pronto per il master",
      description:
        "Il mix e coerente con il riferimento di genere e la dinamica e gia in zona master.",
      intent: "good",
    };
  }

  if (
    score !== null &&
    score >= 5 &&
    ((matchRatio !== null && matchRatio >= 0.6) || lufsInTarget)
  ) {
    return {
      label: "Quasi pronto",
      description:
        "La base e solida, ma servono ancora piccoli ritocchi prima del master.",
      intent: "warn",
    };
  }

  let reason = "Serve ancora lavorare su bilanciamento e dinamica prima del master.";
  if (score !== null && score < 4) {
    reason = "Score basso: meglio concentrarsi su struttura, bilanciamento e pulizia.";
  }

  return {
    label: "Mix da rifinire",
    description: reason,
    intent: "bad",
  };
}





type VersionRow = AnalyzerMetricsFields & {
  id: string;
  version_name: string;
  created_at?: string;
  audio_url?: string | null;
  analyzer_profile_key?: string | null;
  analyzer_mode?: string | null;
  analyzer_key?: string | null;
  fix_suggestions?: FixSuggestion[] | null;
  reference_ai?: ReferenceAi | null;
  analyzer_json?: AnalyzerResult | null;
  analyzer_ai_summary?: string | null;
  analyzer_ai_actions?: AnalyzerAiAction[] | null;
  analyzer_ai_meta?: AnalyzerAiMeta | null;
};

type AnalyzerProPanelProps = {
  version: VersionRow;
  mixV1?: AnalyzerV1Result | null;
  analyzerResult?: AnalyzerResult | null;
  referenceAi?: ReferenceAi | null;
  aiSummary?: string | null;
  aiActions?: AnalyzerAiAction[] | null;
  aiMeta?: AnalyzerAiMeta | null;
  aiLoading?: boolean;
  aiError?: string | null;
  onAskAi?: () => void;
};

const EMPTY_AI_META: AnalyzerAiMeta = {
  artistic_assessment: "",
  risk_flags: [],
  predicted_rank_gain: null,
  label_fit: null,
  structure_feedback: null,
};

export function AnalyzerProPanel({
  version,
  mixV1,
  analyzerResult,
  referenceAi,
  aiSummary,
  aiActions,
  aiMeta,
  aiLoading,
  aiError,
  onAskAi,
}: AnalyzerProPanelProps) {
  const modeLabel = version.analyzer_mode || "Master";
  const profileLabel = version.analyzer_profile_key || "Minimal / Deep Tech";
  const brightnessLabel = getBrightnessLabel(
    version.analyzer_spectral_centroid_hz
  );

  const mixState = getMixState(version.lufs);
  const scoreLabel = getScoreLabel(version.overall_score);
  const refAi = referenceAi ?? version.reference_ai ?? null;
  const effectiveLufs =
    version.lufs ?? mixV1?.metrics?.loudness?.integrated_lufs ?? null;

  const [showAllFix, setShowAllFix] = useState(false);
  const fixSuggestions = version.fix_suggestions ?? [];
  const sortedFixSuggestions = sortFixSuggestions(fixSuggestions);

  const modelMatch = refAi?.model_match || null;
  const matchPercent: number | null =
    modelMatch?.match_percent != null
      ? modelMatch.match_percent
      : refAi != null && typeof refAi.match_ratio === "number"
      ? refAi.match_ratio * 100
      : null;

  const readinessTag = computeReadinessTag({
    lufs: version.lufs,
    overallScore: version.overall_score,
    referenceAi: refAi,
  });

  const effectiveStructureBpm =
    version.analyzer_bpm ?? mixV1?.metrics?.structure?.bpm ?? null;

  const analyzerKeyLabel =
    version.analyzer_key && version.analyzer_key.trim().length > 0
      ? version.analyzer_key.trim().toUpperCase()
      : null;

  const analyzer = (analyzerResult ?? version.analyzer_json ?? null) as AnalyzerResult | null;
  const mixHealthScore =
    typeof analyzer?.mix_health_score === "number" ? analyzer.mix_health_score : null;
  const harmonicBalance = analyzer?.harmonic_balance ?? null;
  const stereoWidth = analyzer?.stereo_width ?? null;
  const confidenceMetrics = analyzer?.confidence ?? null;
  const warningsList: AnalyzerWarning[] = analyzer?.warnings ?? [];
  const confidenceEntries = [
    { label: "Tempo", value: confidenceMetrics?.bpm ?? null },
    { label: "Key", value: confidenceMetrics?.key ?? null },
    { label: "Loudness", value: confidenceMetrics?.lufs ?? null },
    { label: "Spectrum", value: confidenceMetrics?.spectral ?? null },
    { label: "Stereo", value: confidenceMetrics?.stereo ?? null },
    { label: "Mix Health", value: confidenceMetrics?.mix_health ?? null },
  ];
  const crestDb =
    typeof analyzer?.dynamics === "number" ? analyzer.dynamics : null;

  const dynamicsConfidence =
    crestDb != null && Number.isFinite(crestDb)
      ? Math.max(0, Math.min(1, 1 - Math.abs(crestDb - 10) / 12))
      : null;

  const mixHealthBreakdownEntries = [
    {
      label: "Loudness",
      value: confidenceMetrics?.lufs ?? null,
      description: "Volume e target LUFS (più il valore è alto, più il dato è caldo).",
    },
    {
      label: "Tonalità",
      value: confidenceMetrics?.key ?? null,
      description: "Stabilità della key rilevata e rapporto con il progetto.",
    },
    {
      label: "Spettro",
      value: confidenceMetrics?.spectral ?? null,
      description: "Bilanciamento delle frequenze centrali e contrasto tra zone.",
    },
    {
      label: "Stereo",
      value: confidenceMetrics?.stereo ?? null,
      description: "Fiducia nell'analisi dell'apertura stereo e degli L/R.",
    },
    {
      label: "Dinamica",
      value: dynamicsConfidence ?? null,
      description: "Qualità della dinamica/crest (basata sull'output dinamico).",
    },
  ];

  const readiness: TekkinReadinessResult = refAi
    ? evaluateTekkinStatus({
        profileKey: refAi.profile_key,
        mode: version.analyzer_mode,
        matchPercent,
        lufs: version.lufs,
        lufsInTarget: refAi.lufs_in_target,
        crestInTarget: refAi.crest_in_target,
      })
    : {
        status: "unknown" as TekkinReadiness,
        reasons: [],
      };

  const quickBullets = useMemo(() => {
    const items: string[] = [];

    if (version.lufs != null) {
      items.push(`Loudness attuale: ${version.lufs.toFixed(1)} LUFS`);
    }

    if (version.analyzer_bpm != null) {
      const bpmDisplay = formatBpm(version.analyzer_bpm);
      items.push(`BPM rilevato: ${bpmDisplay}`);
    }

    const brightness = getBrightnessLabel(
      version.analyzer_spectral_centroid_hz
    );
    items.push(`Tonalità generale: ${brightness}`);

    return items;
  }, [
    version.lufs,
    version.analyzer_bpm,
    version.analyzer_spectral_centroid_hz,
  ]);

const hasAnalyzerData = !!analyzer || !!refAi || !!mixV1;

  if (!hasAnalyzerData) {
  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-black/70 p-6 text-sm">
      <h3 className="text-base font-semibold">Lancia la tua prima analisi</h3>
      <p className="mt-2 text-[13px] text-white/70">
        Carica una versione audio qui sopra e clicca{" "}
        <span className="font-semibold">“Analyze”</span>. Tekkin Analyzer PRO
        ti restituirà:
      </p>
      <ul className="mt-2 list-disc pl-5 text-[13px] text-white/70">
        <li>Tekkin Score (stato globale del brano).</li>
        <li>Match Tekkin rispetto al genere scelto.</li>
        <li>Piano d’azione con i 3 interventi principali.</li>
      </ul>
      <p className="mt-3 text-[12px] text-white/50">
        Suggerimento: usa una bounce stereo del master o del premaster senza
        limiter brickwall troppo aggressivo.
      </p>
    </section>
  );
}

  const feedbackText = version.feedback ?? "";
  const aiSummaryText = aiSummary ?? version.analyzer_ai_summary ?? null;
  const aiActionsList = aiActions ?? version.analyzer_ai_actions ?? null;
  const aiMetaData = aiMeta ?? version.analyzer_ai_meta ?? null;
  const { label: matchLabel, description: matchDescription } = getMatchBucket(matchPercent);

  const hasAiData =
    Boolean(aiSummaryText?.trim()) ||
    Boolean(aiActionsList?.length) ||
    Boolean(
      aiMetaData &&
        (aiMetaData.artistic_assessment?.trim() ||
          aiMetaData.label_fit?.trim() ||
          aiMetaData.structure_feedback?.trim() ||
          aiMetaData.risk_flags.length > 0)
    );

  const aiCoach: AnalyzerAiCoach | null = hasAiData
    ? {
        summary: aiSummaryText ?? "",
        actions: aiActionsList ?? [],
        meta: aiMetaData ?? EMPTY_AI_META,
      }
    : null;

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-black/70 p-4 md:p-5 shadow-xl shadow-black/50">
      <div className="space-y-6">
        <AnalyzerOverviewSection
          versionName={version.version_name}
          createdAt={version.created_at}
          modeLabel={modeLabel}
          profileLabel={profileLabel}
          tekkinScore={version.overall_score}
          scoreLabel={scoreLabel}
          analyzerKeyLabel={analyzerKeyLabel}
          readiness={readinessTag}
          overallScore={version.overall_score}
          mixHealthScore={mixHealthScore}
          lufs={version.lufs}
          bpm={version.analyzer_bpm}
          quickBullets={quickBullets}
        />
        <TekkinGenreMatchCard referenceAi={refAi} />
        <TekkinAiPlanSection
          coach={aiCoach}
          loadingAi={aiLoading}
          error={aiError}
          onGenerateAi={onAskAi}
        />
        <AnalyzerDetailsSection
          mixHealthScore={mixHealthScore}
          mixHealthBreakdownEntries={mixHealthBreakdownEntries}
          confidenceEntries={confidenceEntries}
          harmonicBalance={harmonicBalance}
          stereoWidth={stereoWidth}
          loudness={version.lufs}
          mixStateLabel={mixState}
          bpm={version.analyzer_bpm}
          brightnessLabel={brightnessLabel}
          spectralCentroidHz={version.analyzer_spectral_centroid_hz}
          spectralRolloffHz={version.analyzer_spectral_rolloff_hz}
          spectralBandwidthHz={version.analyzer_spectral_bandwidth_hz}
          refAi={refAi}
          matchPercent={matchPercent}
          matchLabel={matchLabel}
          matchDescription={matchDescription}
          readiness={readiness}
        />
        <AnalyzerLogsSection
          warnings={warningsList}
          quickBullets={quickBullets}
          mixV1={mixV1}
          effectiveLufs={effectiveLufs}
          effectiveStructureBpm={effectiveStructureBpm}
          fixSuggestions={sortedFixSuggestions}
          showAllFix={showAllFix}
          visibleFixLimit={FIX_VISIBLE_LIMIT}
          onToggleFixSuggestions={() => setShowAllFix((prev) => !prev)}
          feedbackText={feedbackText}
        />
      </div>
    </section>
  );
}
