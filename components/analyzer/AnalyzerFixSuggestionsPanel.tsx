"use client";

import type { FixSuggestion } from "@/types/analyzer";

type FixPriority = "low" | "medium" | "high";

const MAX_STEPS_PER_FIX = 4;

const PRIORITY_LABELS: Record<FixPriority, string> = {
  high: "Alta priorità",
  medium: "Priorità media",
  low: "Bassa priorità",
};

const PRIORITY_STYLES: Record<FixPriority, string> = {
  high: "text-amber-200 bg-amber-500/20",
  medium: "text-emerald-200 bg-emerald-500/20",
  low: "text-slate-200 bg-slate-500/20",
};

type AnalyzerFixSuggestionsPanelProps = {
  suggestions: FixSuggestion[];
  showAll: boolean;
  visibleLimit: number;
  onToggle: () => void;
};

export function AnalyzerFixSuggestionsPanel({
  suggestions,
  showAll,
  visibleLimit,
  onToggle,
}: AnalyzerFixSuggestionsPanelProps) {
  if (suggestions.length === 0) return null;

  const visibleSuggestions = showAll
    ? suggestions
    : suggestions.slice(0, visibleLimit);

  return (
    <section className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-emerald-100">
            Piano d'azione Tekkin
          </h3>
          <p className="text-[11px] text-emerald-200/70">
            Le mosse principali per migliorare questa versione.
          </p>
        </div>
        <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
          Mix roadmap
        </span>
      </div>

      <ol className="space-y-2">
        {visibleSuggestions.map((suggestion, index) => {
          const priority = (
            suggestion.priority ?? "medium"
          ).toLowerCase() as FixPriority;
          const badgeLabel = PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.medium;
          const badgeStyle = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
          const steps = suggestion.steps?.slice(0, MAX_STEPS_PER_FIX) ?? [];

          return (
            <li
              key={`${suggestion.issue}-${index}`}
              className="rounded-xl bg-black/40 px-3 py-2 text-xs"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{suggestion.issue}</span>
                <span
                  className={`rounded-full px-2 py-[2px] text-[10px] uppercase tracking-wide ${badgeStyle}`}
                >
                  {badgeLabel}
                </span>
              </div>
              <p className="mb-1 text-[11px] text-white/70">
                {suggestion.analysis}
              </p>
              {steps.length > 0 && (
                <ol className="list-inside list-decimal space-y-1 pl-2 text-[11px] text-white/60">
                  {steps.map((step, stepIndex) => (
                    <li key={`${stepIndex}-${step}`}>{step}</li>
                  ))}
                  {suggestion.steps && suggestion.steps.length > MAX_STEPS_PER_FIX && (
                    <li className="text-white/40">...altri passaggi</li>
                  )}
                </ol>
              )}
            </li>
          );
        })}
      </ol>

      {suggestions.length > visibleLimit && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-full border border-emerald-400/50 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-400/10"
          >
            {showAll ? "Mostra meno" : "Mostra tutte"}
          </button>
        </div>
      )}
    </section>
  );
}
