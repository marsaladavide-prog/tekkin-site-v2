"use client";

import { AnalyzerHeader, type ReadinessInfo } from "./AnalyzerHeader";
import { formatBpm, getReferenceGenreLabel } from "./analyzerDisplayUtils";
import type { ReferenceAi } from "@/types/analyzer";

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
  issueHighlights: string[];
  referenceAi?: ReferenceAi | null;
  matchPercent?: number | null;
  matchLabel: string;
  matchDescription: string;
};

type MatchIntensity = "strong" | "medium" | "weak" | "unknown";

const MATCH_TAG_LABELS: Record<MatchIntensity, string> = {
  strong: "Match forte",
  medium: "Match medio",
  weak: "Match debole",
  unknown: "Match sconosciuto",
};

function getMatchIntensity(matchPercent?: number | null): MatchIntensity {
  if (matchPercent == null) return "unknown";
  if (matchPercent >= 80) return "strong";
  if (matchPercent >= 60) return "medium";
  return "weak";
}

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
  issueHighlights,
  referenceAi,
  matchPercent,
  matchLabel,
  matchDescription,
}: AnalyzerOverviewSectionProps) {
  const summaryScoreValue = overallScore ?? mixHealthScore ?? null;
  const summaryScoreLabel =
    overallScore != null
      ? "Tekkin score"
      : mixHealthScore != null
      ? "Mix health score"
      : "Score non disponibile";
  const quickHighlights = quickBullets.slice(0, 3);
  const genreLabel = getReferenceGenreLabel(referenceAi);
  const matchIntensity = getMatchIntensity(matchPercent);
  const matchTagLabel = MATCH_TAG_LABELS[matchIntensity];
  const displayedIssues = issueHighlights.filter(Boolean).slice(0, 3);

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
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/15 bg-black/70 px-3.5 py-3 text-sm">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/60">
            Score sintetico
          </p>
          <p className="mt-1 text-3xl font-semibold text-white">
            {summaryScoreValue != null ? summaryScoreValue.toFixed(1) : "n.a."}
          </p>
          <p className="text-[11px] text-white/60">{summaryScoreLabel}</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-black/70 px-3.5 py-3 text-sm">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/60">
            Loudness attuale
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {lufs != null ? `${lufs.toFixed(1)} LUFS` : "n.a."}
          </p>
          <p className="text-[11px] text-white/60">Target -8.5 / -7 dB</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-black/70 px-3.5 py-3 text-sm">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/60">
            BPM rilevato
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {formatBpm(bpm)}
          </p>
          <p className="text-[11px] text-white/60">Usalo per set e reference</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs md:text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                Profilo Tekkin tecnico
              </p>
              {genreLabel ? (
                <p className="mt-1 text-sm font-semibold text-white">{genreLabel}</p>
              ) : (
                <p className="mt-1 text-sm font-semibold text-white/60">
                  Profilo non assegnato
                </p>
              )}
              <p className="mt-2 text-[11px] leading-snug text-white/70">
                {matchDescription || "Match ancora in calcolo dal sistema Tekkin."}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-right">
                <p className="text-xl font-bold leading-none text-white">
                  {matchPercent != null ? `${matchPercent}%` : "--"}
                </p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">
                  match
                </p>
              </div>
              <span className="mt-1 inline-flex rounded-full bg-black/40 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/70">
                {matchTagLabel}
              </span>
            </div>
          </div>
          {matchLabel && (
            <p className="mt-3 text-sm text-white">{matchLabel}</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/15 bg-black/60 p-4 text-[11px] text-white/80">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
            Problemi principali
          </p>
          {displayedIssues.length ? (
            <ul className="mt-3 space-y-2">
              {displayedIssues.map((issue) => (
                <li key={issue} className="flex items-start gap-2 text-white/70">
                  <span className="text-emerald-300">•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[11px] text-white/55">
              Nessuna criticità già segnalata nel percorso AI.
            </p>
          )}
        </div>
      </div>

      {quickHighlights.length > 0 && (
        <div className="mt-5 rounded-xl border border-white/12 bg-black/70 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-white/60">
            Highlights veloci
          </p>
          <ul className="mt-2 space-y-2 text-[11px]">
            {quickHighlights.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2 text-white/70">
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
