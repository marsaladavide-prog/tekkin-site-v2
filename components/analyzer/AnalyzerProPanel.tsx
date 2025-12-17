"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AnalyzerMetricsFields,
  AnalyzerResult,
  AnalyzerWarning,
  FixSuggestion,
  ReferenceAi,
  AnalyzerAiAction,
  AnalyzerAiCoach,
  AnalyzerAiMeta,
} from "@/types/analyzer";
import type { GenreReference, BandsNorm } from "@/lib/reference/types";
import { compareBandsToGenre, type BandCompare } from "@/lib/reference/compareBandsToGenre";

import type {
  TekkinReadiness,
  TekkinReadinessResult,
} from "@/lib/tekkinProfiles";

import { evaluateTekkinStatus } from "@/lib/tekkinProfiles";
import { AnalyzerOverviewSection } from "./AnalyzerOverviewSection";
import { TekkinAiPlanSection } from "./TekkinAiPlanSection";
import { AnalyzerDetailsSection } from "./AnalyzerDetailsSection";
import { AskAnalyzerAI } from "./AskAnalyzerAI";
import type { AnalyzerReadinessIntent } from "./AnalyzerReadinessTag";
import { sortByPriority } from "./analyzerActionUtils";
import {
  formatBpm,
  getBrightnessLabel,
  getMatchBucket,
  getMixState,
  getScoreLabel,
} from "./analyzerDisplayUtils";

type ReadinessTag = {
  label: string;
  description: string;
  intent: AnalyzerReadinessIntent;
};

function normalizeProfileKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  return normalized || null;
}

function mapWarningSeverity(x: unknown): AnalyzerWarning["severity"] {
  if (x === "info") return "info";
  return "warning"; // warning, critical, altro -> warning
}

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
  model_match_percent?: number | null;
  analyzer_bands_norm?: BandsNorm | null;
  fix_suggestions?: FixSuggestion[] | null;
  reference_ai?: ReferenceAi | null;
  analyzer_json?: AnalyzerResult | null;
  analyzer_ai_summary?: string | null;
  analyzer_ai_actions?: AnalyzerAiAction[] | null;
  analyzer_ai_meta?: AnalyzerAiMeta | null;
};

type AnalyzerProPanelProps = {
  version: VersionRow;
  aiSummary?: string | null;
  aiActions?: AnalyzerAiAction[] | null;
  aiMeta?: AnalyzerAiMeta | null;
  aiLoading?: boolean;
  onAskAi?: () => void;
  analyzerResult?: AnalyzerResult | null;
  referenceAi?: ReferenceAi | null;
  reference?: GenreReference | null;
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
  aiSummary,
  aiActions,
  aiMeta,
  aiLoading,
  onAskAi,
  analyzerResult,
  referenceAi,
  reference,
}: AnalyzerProPanelProps) {
  const modeLabel = version.analyzer_mode || "Master";
  const profileLabel = version.analyzer_profile_key || "Minimal / Deep Tech";
  const brightnessLabel = getBrightnessLabel(
    version.analyzer_spectral_centroid_hz
  );

  const mixState = getMixState(version.lufs);
  const scoreLabel = getScoreLabel(version.overall_score);
  const refAi = referenceAi ?? version.reference_ai ?? null;
  const fixSuggestions: FixSuggestion[] = Array.isArray(version.fix_suggestions)
    ? version.fix_suggestions
    : [];
  const sortedFixSuggestions = sortByPriority(fixSuggestions);

  const matchPercent: number | null =
    typeof version.model_match_percent === "number"
      ? version.model_match_percent
      : refAi != null && typeof refAi.match_ratio === "number"
      ? refAi.match_ratio * 100
      : null;

  const readinessTag = computeReadinessTag({
    lufs: version.lufs,
    overallScore: version.overall_score,
    referenceAi: refAi,
  });

  const analyzerKeyLabel =
    version.analyzer_key && version.analyzer_key.trim().length > 0
      ? version.analyzer_key.trim().toUpperCase()
      : null;

  const analyzer = (analyzerResult ?? version.analyzer_json ?? null) as AnalyzerResult | null;
  const analyzerBandsNorm: BandsNorm | null = useMemo(() => {
    const fromAnalyzer = (analyzer as unknown as { spectral?: { band_norm?: BandsNorm } } | null)?.spectral?.band_norm;
    if (fromAnalyzer && typeof fromAnalyzer === "object") {
      return fromAnalyzer as BandsNorm;
    }
    const fromVersion = (version as { analyzer_bands_norm?: BandsNorm | null }).analyzer_bands_norm;
    if (fromVersion && typeof fromVersion === "object") {
      return fromVersion as BandsNorm;
    }
    return null;
  }, [analyzer, version]);

  const rawProfileKey =
    (analyzer as unknown as { analysis_scope?: { profile_key?: string | null } | null })
      ?.analysis_scope?.profile_key ??
    (analyzer as unknown as { profile_key?: string | null })?.profile_key ??
    (refAi as unknown as { profile_key?: string | null })?.profile_key ??
    version.analyzer_profile_key ??
    null;

  const profileKey = normalizeProfileKey(rawProfileKey);

  const [genreRef, setGenreRef] = useState<GenreReference | null>(reference ?? null);
  const [genreRefError, setGenreRefError] = useState<string | null>(null);

  useEffect(() => {
    if (reference) {
      setGenreRef(reference);
      setGenreRefError(null);
      return;
    }

    let cancelled = false;

    async function run() {
      setGenreRef(null);
      setGenreRefError(null);

      if (!profileKey) {
        setGenreRefError("Missing profile_key");
        return;
      }

      try {
        const res = await fetch(`/api/reference/${encodeURIComponent(profileKey)}`, {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error || `Failed (${res.status})`);
        }
        const data = (await res.json()) as GenreReference;
        if (!cancelled) setGenreRef(data);
      } catch (e: any) {
        if (!cancelled) setGenreRefError(e?.message || "Failed to load reference");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [profileKey, reference]);

  const effectiveRef = reference ?? genreRef;

  const bandsCompare: BandCompare[] | null = useMemo(() => {
    if (!effectiveRef) return null;
    return compareBandsToGenre(analyzerBandsNorm ?? null, effectiveRef);
  }, [analyzerBandsNorm, effectiveRef]);
  const mixHealthScore =
    typeof analyzer?.mix_health_score === "number" ? analyzer.mix_health_score : null;
  const harmonicBalance = analyzer?.harmonic_balance ?? null;
  const stereoWidth = analyzer?.stereo_width ?? null;
  const confidenceMetrics = analyzer?.confidence ?? null;
  const warningsList: AnalyzerWarning[] = (analyzer?.warnings ?? []).map((w: any) => ({
    ...w,
    severity: mapWarningSeverity(w?.severity),
  }));
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

  const hasAnalyzerData = !!analyzer || !!refAi;

  const issueHighlights = useMemo(() => {
    const highlights: string[] = [];
    const seen = new Set<string>();

    const push = (text?: string | null) => {
      if (!text) return;
      const trimmed = text.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      highlights.push(trimmed);
    };

    for (const suggestion of sortedFixSuggestions) {
      push(suggestion.issue);
      if (highlights.length >= 3) return highlights;
    }

    for (const warning of warningsList) {
      push(warning.message);
      if (highlights.length >= 3) return highlights;
    }

    const list = aiActions ?? version.analyzer_ai_actions ?? null;
    if (list) {
      for (const action of list) {
        push(action.title);
        if (highlights.length >= 3) return highlights;
      }
    }

    return highlights;
  }, [sortedFixSuggestions, warningsList, aiActions, version.analyzer_ai_actions]);

  if (!hasAnalyzerData) {
    return (
      <section className="mt-4 rounded-2xl border border-white/10 bg-black/70 p-6 text-sm">
        <h3 className="text-base font-semibold">Lancia la tua prima analisi</h3>
        <p className="mt-2 text-[13px] text-white/70">
          Carica una versione audio qui sopra e clicca{" "}
          <span className="font-semibold">Analyze</span>. Tekkin Analyzer PRO ti
          restituirà:
        </p>
        <ul className="mt-2 list-disc pl-5 text-[13px] text-white/70">
          <li>Tekkin Score (stato globale del brano).</li>
          <li>Match Tekkin rispetto al genere scelto.</li>
          <li>Piano d&apos;azione con i 3 interventi principali.</li>
        </ul>
        <p className="mt-3 text-[12px] text-white/50">
          Suggerimento: usa una bounce stereo del master o del premaster senza
          limiter brickwall troppo aggressivo.
        </p>
      </section>
    );
  }

  // 1 - variabili di testo AI
  const feedbackText = version.feedback ?? "";
  const aiSummaryText = aiSummary ?? version.analyzer_ai_summary ?? null;
  const aiActionsList = aiActions ?? version.analyzer_ai_actions ?? null;
  const aiMetaData = aiMeta ?? version.analyzer_ai_meta ?? null;

  // 2 - flag se c’è davvero qualcosa di utile lato AI
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

  // 3 - oggetto coach unico
  const aiCoach: AnalyzerAiCoach | null = hasAiData
    ? {
        summary: aiSummaryText ?? "",
        actions: aiActionsList ?? [],
        meta: aiMetaData ?? EMPTY_AI_META,
      }
    : null;

  // 4 - highlight problemi principali
  const { label: matchLabel, description: matchDescription } =
    getMatchBucket(matchPercent);

  const handleGenerateAiForVersion = () => {
    onAskAi?.();
  };

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-black/70 p-4 md:p-5 shadow-xl shadow-black/50">
      <div className="space-y-8">
        {/* A. Overview compatta */}
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
          issueHighlights={issueHighlights}
          referenceAi={refAi}
          matchPercent={matchPercent}
          matchLabel={matchLabel}
          matchDescription={matchDescription}
        />

        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Genre Compare</div>
              <div className="text-xs text-zinc-400">Artist vs reference range (p10 to p90)</div>
            </div>
            <div className="text-xs text-zinc-500">{profileKey ?? "n.a."}</div>
          </div>

          {!analyzerBandsNorm && (
            <div className="mt-4 rounded-md border border-zinc-800 p-3 text-sm text-zinc-400">
              Legacy analysis. Re-run analyzer to unlock this comparison.
            </div>
          )}

          {genreRefError && (
            <div className="mt-4 rounded-md border border-zinc-800 p-3 text-sm text-zinc-400">
              Reference not available: {genreRefError}
            </div>
          )}

          {!bandsCompare && !genreRefError && analyzerBandsNorm && (
            <div className="mt-4 text-sm text-zinc-400">Loading reference…</div>
          )}

          {bandsCompare && (
            <div className="mt-4 grid grid-cols-1 gap-2">
              {bandsCompare.map((b) => {
                const p10 = b.p10 ?? 0;
                const p90 = b.p90 ?? 1;
                const artist = b.artist ?? 0;

                const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
                const left = clamp01(p10) * 100;
                const width = clamp01(p90 - p10) * 100;
                const dot = clamp01(artist) * 100;

                const statusColor =
                  b.status === "ok"
                    ? "text-emerald-400"
                    : b.status === "warn"
                    ? "text-yellow-400"
                    : b.status === "off"
                    ? "text-red-400"
                    : "text-zinc-500";

                return (
                  <div
                    key={b.key}
                    className="flex items-center gap-3 rounded-md border border-zinc-800 px-3 py-2"
                  >
                    <div className="w-20 text-xs uppercase tracking-wide text-zinc-400">
                      {b.key}
                    </div>

                    <div className="relative h-2 flex-1 rounded bg-zinc-900">
                      <div
                        className="absolute top-0 h-2 rounded bg-zinc-700/70"
                        style={{ left: `${left}%`, width: `${width}%` }}
                      />
                      <div
                        className="absolute -top-1 h-4 w-[2px] bg-white/90"
                        style={{ left: `${dot}%` }}
                        title={`artist=${b.artist ?? "n/a"}`}
                      />
                    </div>

                    <div className={`w-16 text-right text-xs ${statusColor}`}>
                      {b.status}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* B. Piano Tekkin AI */}
        <TekkinAiPlanSection
          aiCoach={aiCoach}
          isGenerating={Boolean(aiLoading)}
          hasAnalyzerResult={Boolean(analyzer)}
          onGenerateAi={handleGenerateAiForVersion}
        />

        {/* C. Q&A */}
        <AskAnalyzerAI versionId={version.id} />

        {/* D. Dettaglio tecnico */}
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
  warnings={warningsList}
  feedbackText={feedbackText}
  bandsCompare={bandsCompare}
/>
      </div>
    </section>
  );
}
