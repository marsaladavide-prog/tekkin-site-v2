"use client";

import { Info } from "lucide-react";
import { AnalyzerCollapsibleSection } from "./AnalyzerCollapsibleSection";
import { AnalyzerFixSuggestionsPanel } from "./AnalyzerFixSuggestionsPanel";
import { getWarningBadgeClass } from "./analyzerDisplayUtils";
import type {
  AnalyzerIssue,
  AnalyzerV1Result,
  AnalyzerWarning,
  FixSuggestion,
} from "@/types/analyzer";

type AnalyzerLogsSectionProps = {
  warnings: AnalyzerWarning[];
  quickBullets: string[];
  mixV1?: AnalyzerV1Result | null;
  effectiveLufs: number | null;
  effectiveStructureBpm: number | null;
  fixSuggestions: FixSuggestion[];
  showAllFix: boolean;
  visibleFixLimit: number;
  onToggleFixSuggestions: () => void;
  feedbackText: string;
};

export function AnalyzerLogsSection({
  warnings,
  quickBullets,
  mixV1,
  effectiveLufs,
  effectiveStructureBpm,
  fixSuggestions,
  showAllFix,
  visibleFixLimit,
  onToggleFixSuggestions,
  feedbackText,
}: AnalyzerLogsSectionProps) {
  return (
    <AnalyzerCollapsibleSection title="Log Tekkin Analyzer e report completo">
      <>
        {warnings.length > 0 && (
          <section className="rounded-xl border border-white/12 bg-black/85 px-3.5 py-3">
            <div className="flex items-center gap-1.5">
              <Info className="h-4 w-4 text-emerald-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Analyzer warnings &amp; notes
              </span>
            </div>
            <div className="mt-3 space-y-2 text-[11px] text-white/80">
              {warnings.map((warning, index) => (
                <div
                  key={`${warning.code}-${index}`}
                  className="flex flex-col gap-1 rounded-lg border border-white/15 bg-white/5 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">
                      {warning.message}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${getWarningBadgeClass(
                        warning.severity
                      )}`}
                    >
                      {warning.severity}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/60">
                    Codice: {warning.code}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="rounded-xl border border-white/12 bg-black/85 px-3.5 py-3">
          <div className="flex items-center gap-1.5">
            <Info className="h-4 w-4 text-emerald-300" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
              Quick mix report
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/60">
            Punti chiave estratti dal report tecnico.
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-white/80">
            {quickBullets.map((bullet) => (
              <li key={bullet}>• {bullet}</li>
            ))}
          </ul>
        </div>

        {mixV1 && (
          <section className="rounded-xl border border-white/12 bg-black/70 px-3.5 py-3">
            <div className="flex items-center gap-1.5">
              <Info className="h-4 w-4 text-cyan-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Tekkin Analyzer V1
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-[11px] text-white/80 md:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase text-white/50">Loudness</p>
                <p className="text-sm font-semibold text-white">
                  {effectiveLufs != null
                    ? `${effectiveLufs.toFixed(1)} LUFS`
                    : "n.a."}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-white/50">Structure BPM</p>
                <p className="text-sm font-semibold text-white">
                  {effectiveStructureBpm != null
                    ? `${effectiveStructureBpm.toFixed(0)} BPM`
                    : "n.a."}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-white/50">Structure bars</p>
                <p className="text-sm font-semibold text-white">
                  {mixV1.metrics.structure.bars_total} barre
                </p>
              </div>
            </div>
            {mixV1.issues && mixV1.issues.length > 0 && (
              <div className="mt-3 space-y-3 text-xs text-white/80">
                {mixV1.issues.map((issue: AnalyzerIssue, index: number) => (
                  <div
                    key={`${issue.issue}-${index}`}
                    className="rounded-lg border border-white/15 bg-white/5 p-3"
                  >
                    <p className="text-sm font-semibold text-white">{issue.issue}</p>
                    <p className="mt-1 text-[11px] text-white/70">
                      {issue.analysis}
                    </p>
                    {issue.suggestion && (
                      <p className="mt-1 text-[11px] text-lime-200">
                        Suggerimento: {issue.suggestion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <AnalyzerFixSuggestionsPanel
          suggestions={fixSuggestions}
          showAll={showAllFix}
          visibleLimit={visibleFixLimit}
          onToggle={onToggleFixSuggestions}
        />

        <div className="rounded-xl border border-white/15 bg-black px-3.5 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/65">
            <Info className="h-4 w-4 text-emerald-300" />
            Report tecnico completo
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg bg-black/90 p-2">
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/80">
              {feedbackText || "Nessun report testuale disponibile per questa versione."}
            </pre>
          </div>
        </div>
      </>
    </AnalyzerCollapsibleSection>
  );
}
