"use client";

import { Waves } from "lucide-react";
import { AnalyzerReadinessTag, type AnalyzerReadinessIntent } from "./AnalyzerReadinessTag";

export type ReadinessInfo = {
  label: string;
  description?: string;
  intent: AnalyzerReadinessIntent;
};

type AnalyzerHeaderProps = {
  versionName: string;
  createdAt?: string;
  modeLabel: string;
  profileLabel: string;
  tekkinScore?: number | null;
  scoreLabel: string;
  analyzerKeyLabel?: string | null;
  readiness: ReadinessInfo;
};

function formatAnalysisDate(createdAt?: string) {
  if (!createdAt) return "data non disponibile";
  const evaluated = new Date(createdAt);
  if (Number.isNaN(evaluated.getTime())) return "data non disponibile";
  return evaluated.toLocaleString("it-IT");
}

export function AnalyzerHeader({
  versionName,
  createdAt,
  modeLabel,
  profileLabel,
  tekkinScore,
  scoreLabel,
  analyzerKeyLabel,
  readiness,
}: AnalyzerHeaderProps) {
  const createdAtLabel = formatAnalysisDate(createdAt);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 rounded-lg bg-emerald-500/20 p-2">
          <Waves className="h-4 w-4 text-emerald-300" />
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-emerald-300">
            Tekkin Analyzer PRO
          </p>
          <p className="text-sm font-medium text-white">Versione {versionName}</p>
          <p className="mt-0.5 text-[11px] text-white/55">
            Analizzato il {createdAtLabel}. Engine v3.6 con extras BPM e spectral.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 text-right">
        <div className="flex gap-2">
          <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
            {modeLabel}
          </span>
          <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
            {profileLabel}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] uppercase tracking-wide text-white/55">
            Tekkin score
          </span>
          <span className="text-xl font-semibold text-white">
            {tekkinScore != null ? tekkinScore.toFixed(1) : "n.a."}
          </span>
          {tekkinScore != null && (
            <span className="text-[11px] text-white/55">({scoreLabel})</span>
          )}
        </div>
        {analyzerKeyLabel && (
          <p className="text-[11px] text-white/55">Key: {analyzerKeyLabel}</p>
        )}
        <AnalyzerReadinessTag
          label={readiness.label}
          description={readiness.description}
          intent={readiness.intent}
        />
      </div>
    </div>
  );
}
