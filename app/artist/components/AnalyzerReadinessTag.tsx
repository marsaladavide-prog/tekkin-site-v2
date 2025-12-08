"use client";

type AnalyzerReadinessIntent = "good" | "warn" | "bad";

const INTENT_STYLES: Record<AnalyzerReadinessIntent, string> = {
  good: "text-emerald-200 bg-emerald-500/20",
  warn: "text-amber-200 bg-amber-500/20",
  bad: "text-red-200 bg-red-500/20",
};

type AnalyzerReadinessTagProps = {
  label: string;
  description?: string;
  intent: AnalyzerReadinessIntent;
};

export type { AnalyzerReadinessIntent };
export function AnalyzerReadinessTag({ label, description, intent }: AnalyzerReadinessTagProps) {
  return (
    <div className="flex flex-col gap-1 text-right">
      <span
        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${INTENT_STYLES[intent]}`}
      >
        {label}
      </span>
      {description ? (
        <p className="text-[11px] text-white/60">{description}</p>
      ) : null}
    </div>
  );
}
