"use client";

import type {
  ActionCategoryKey,
  ActionPriority,
  AnalyzerInterventionAction,
} from "./analyzerActionUtils";
import { CATEGORY_LABELS, PRIORITY_ORDER } from "./analyzerActionUtils";

const CATEGORY_ORDER: ActionCategoryKey[] = [
  "sub",
  "kick_clap",
  "percussions",
  "hihat",
  "vocals",
  "stereo_high",
  "stereo",
  "transients",
  "dynamics",
];

const PRIORITY_BADGE_STYLES: Record<ActionPriority, string> = {
  high: "text-red-200 bg-red-500/20",
  medium: "text-amber-200 bg-amber-500/20",
  low: "text-emerald-200 bg-emerald-500/20",
};

type AnalyzerActionGroupsProps = {
  actions: AnalyzerInterventionAction[];
};

export function AnalyzerActionGroups({ actions }: AnalyzerActionGroupsProps) {
  if (!actions.length) return null;

  const grouped: Record<ActionCategoryKey, AnalyzerInterventionAction[]> = CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = [];
      return acc;
    },
    {} as Record<ActionCategoryKey, AnalyzerInterventionAction[]>
  );

  actions.forEach((action) => {
    grouped[action.category] = grouped[action.category] ?? [];
    grouped[action.category].push(action);
  });

  const hasContent = CATEGORY_ORDER.some(
    (category) => grouped[category]?.length > 0
  );
  if (!hasContent) return null;

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.map((category) => {
        const bucket = grouped[category];
        if (!bucket || bucket.length === 0) return null;

        const ordered = [...bucket].sort(
          (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        );

        return (
          <section
            key={category}
            className="rounded-2xl border border-white/10 bg-black/80 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                {CATEGORY_LABELS[category]}
              </p>
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                {ordered.length} interventi
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {ordered.map((action) => (
                <article
                  key={action.id}
                  className="rounded-xl border border-white/10 bg-black/70 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{action.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${PRIORITY_BADGE_STYLES[action.priority]}`}
                    >
                      {action.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-white/70">{action.description}</p>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
