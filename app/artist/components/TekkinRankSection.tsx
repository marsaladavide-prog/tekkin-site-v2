"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useArtistRank } from "@/app/artist/hooks/useArtistRank";
import type { ArtistRankView } from "@/types/tekkinRank";

type TekkinRankSectionProps = {
  className?: string;
  overrideData?: ArtistRankView;
};

export function TekkinRankSection({
  className,
  overrideData,
}: TekkinRankSectionProps) {
  const { data: hookData, loading: isLoading, error } = useArtistRank();

  const view: ArtistRankView | null = useMemo(() => {
    if (overrideData) return overrideData;
    if (hookData) return hookData;
    return null;
  }, [overrideData, hookData]);

  if (isLoading && !view) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 animate-pulse",
          className
        )}
      >
        <div className="h-4 w-24 rounded bg-zinc-800/70" />
        <div className="mt-3 h-8 w-32 rounded bg-zinc-800/70" />
        <div className="mt-4 h-20 rounded-xl bg-zinc-900/60" />
      </div>
    );
  }

  if (error && !view) {
    console.error("[TekkinRankSection] useArtistRank error:", error);
    return (
      <div
        className={cn(
          "rounded-2xl border border-red-900 bg-red-950/40 p-4 text-xs text-red-100",
          className
        )}
      >
        Non riesco a caricare il Tekkin Rank al momento.
      </div>
    );
  }

  if (!view) {
    return null;
  }

  const { rank, metrics } = view;

  const followersNow = metrics?.spotify_followers ?? null;
  const followersDiff30d = metrics?.spotify_followers_diff_30d ?? 0;
  const popularity = metrics?.spotify_popularity ?? null;
  const releasesLast12m = metrics?.releases_last_12m ?? 0;
  const analyzedVersions = metrics?.analyzed_versions ?? 0;

  const lastUpdatedLabel = metrics?.collected_at
    ? new Date(metrics.collected_at).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
    : null;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950/90 to-zinc-900/60 p-4 md:p-5",
        "shadow-[0_0_40px_rgba(0,0,0,0.7)]",
        className
      )}
    >
      {/* Glow Tekkin sottile */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-24 top-0 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Score principale */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            Tekkin Rank
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-zinc-50 md:text-5xl">
              {rank.tekkin_score}
            </span>
            <span className="text-xs text-zinc-500">/ 100</span>
          </div>
          <p className="mt-1 text-xs text-zinc-300">{rank.level}</p>

          {followersNow !== null && (
            <p className="mt-2 text-[11px] text-zinc-400">
              Spotify followers:{" "}
              <span className="font-medium text-zinc-200">
                {followersNow.toLocaleString("it-IT")}
              </span>
            </p>
          )}

          {lastUpdatedLabel && (
            <p className="mt-1 text-[10px] text-zinc-500">
              Ultimo aggiornamento: {lastUpdatedLabel}
            </p>
          )}
        </div>

        {/* Breakdown compatto */}
        <div className="grid w-full grid-cols-2 gap-3 text-xs md:max-w-md md:grid-cols-4">
          {/* Growth */}
          <MiniStatCard
            label="Growth"
            value={
              followersDiff30d > 0
                ? `+${followersDiff30d}`
                : followersDiff30d === 0
                ? "0"
                : followersDiff30d
            }
            hint="followers 30d"
            score={rank.growth_score}
            max={30}
          />

          {/* Presence */}
          <MiniStatCard
            label="Presence"
            value={popularity != null ? popularity : "n.a."}
            hint="/ 100 popularity"
            score={rank.presence_score}
            max={25}
          />

          {/* Catalog */}
          <MiniStatCard
            label="Catalog"
            value={releasesLast12m}
            hint="release 12 mesi"
            score={rank.catalog_score}
            max={30}
          />

          {/* Tekkin Activity */}
          <MiniStatCard
            label="Tekkin Activity"
            value={analyzedVersions}
            hint="versioni analizzate"
            score={rank.activity_score}
            max={15}
          />
        </div>
      </div>
    </section>
  );
}

type MiniStatCardProps = {
  label: string;
  value: number | string;
  hint?: string;
  score: number;
  max: number;
};

function MiniStatCard({ label, value, hint, score, max }: MiniStatCardProps) {
  const ratio = max > 0 ? Math.min(Math.max(score / max, 0), 1) : 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-zinc-50">
        {value}
        {hint && (
          <span className="ml-1 text-[10px] font-normal text-zinc-500">
            {hint}
          </span>
        )}
      </div>

      {/* progress bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <p className="mt-1 text-[10px] text-zinc-500">
        Score:{" "}
        <span className="font-medium text-zinc-300">
          {score}/{max}
        </span>
      </p>
    </div>
  );
}
