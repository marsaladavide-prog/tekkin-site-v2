"use client";

import { AnalyzerHeader, type ReadinessInfo } from "./AnalyzerHeader";
import { formatBpm } from "./analyzerDisplayUtils";

type AnalyzerOverviewSectionProps = {
  versionName: string;
  createdAt?: string;
  modeLabel: string;
  profileLabel: string;
  tekkinScore?: number | null;
  scoreLabel: string;
  analyzerKeyLabel?: string | null;
  readiness: ReadinessInfo;
  overallScore?: number | null;
  mixHealthScore?: number | null;
  lufs?: number | null;
  bpm?: number | null;
  quickBullets: string[];
};

export function AnalyzerOverviewSection({
  versionName,
  createdAt,
  modeLabel,
  profileLabel,
  tekkinScore,
  scoreLabel,
  analyzerKeyLabel,
  readiness,
  overallScore,
  mixHealthScore,
  lufs,
  bpm,
  quickBullets,
}: AnalyzerOverviewSectionProps) {
  const summaryScoreValue = overallScore ?? mixHealthScore ?? null;
  const summaryScoreLabel = overallScore != null ? "Tekkin score" : mixHealthScore != null ? "Mix health score" : "Score non disponibile";
  const quickHighlights = quickBullets.slice(0, 3);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/80 p-5">
      <AnalyzerHeader
        versionName={versionName}
        createdAt={createdAt}
        modeLabel={modeLabel}
        profileLabel={profileLabel}
        tekkinScore={tekkinScore}
        scoreLabel={scoreLabel}
        analyzerKeyLabel={analyzerKeyLabel}
        readiness={readiness}
      />

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/15 bg-black/70 px-3.5 py-3 text-sm">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/60">Score sintetico</p>
          <p className="mt-1 text-3xl font-semibold text-white">
            {summaryScoreValue != null ? summaryScoreValue.toFixed(1) : "n.a."}
          </p>
          <p className="text-[11px] text-white/60">{summaryScoreLabel}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-black/70 px-3.5 py-3 text-sm">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/60">Loudness</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {lufs != null ? `${lufs.toFixed(1)} LUFS` : "n.a."}
          </p>
          <p className="text-[11px] text-white/60">Target -8.5 / -7 dB</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-black/70 px-3.5 py-3 text-sm">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/60">BPM rilevato</p>
          <p className="mt-1 text-2xl font-semibold text-white">{formatBpm(bpm)}</p>
          <p className="text-[11px] text-white/60">Usalo per set e riferimento</p>
        </div>
      </div>

      {quickHighlights.length > 0 && (
        <div className="mt-5 rounded-xl border border-white/15 bg-black/70 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-white/60">Highlights veloci</p>
          <ul className="mt-2 space-y-2 text-[11px] text-white/80">
            {quickHighlights.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <span className="mt-[2px] text-sm text-emerald-300">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
