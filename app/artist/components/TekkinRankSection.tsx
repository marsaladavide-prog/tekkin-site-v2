"use client";

import { useArtistRank } from "../hooks/useArtistRank";

function getFormLabel(score: number): string {
  if (score >= 80) return "High Form";
  if (score >= 60) return "In Growth";
  return "Building Phase";
}

function formatNumber(n?: number | null): string {
  if (!n || n <= 0) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function formatChange(change?: number | null): { label: string; positive: boolean } {
  if (change == null) return { label: "n.a.", positive: true };
  const sign = change >= 0 ? "+" : "";
  return {
    label: `${sign}${change.toFixed(0)}% vs last season`,
    positive: change >= 0,
  };
}

export function TekkinRankSection() {
  const { data, loading, error } = useArtistRank();

  if (loading) {
    return (
      <section className="mt-6 h-36 rounded-3xl border border-[#1f1f23] bg-[#0c0c0e] px-8 py-6 animate-pulse" />
    );
  }

  if (error || !data) {
    return (
      <section className="mt-6 rounded-3xl border border-red-700/50 bg-red-900/20 px-8 py-4 text-sm text-red-300">
        Errore nel caricamento del Tekkin Rank. Riprova piu tardi.
      </section>
    );
  }

  const { rank, metrics } = data;
  const formLabel = getFormLabel(rank.tekkin_score);

  const spotifyStreams = metrics?.spotify_streams_total ?? 0;
  const spotifyChange = formatChange(metrics?.spotify_streams_change);
  const beatportCharts = metrics?.beatport_charts ?? 0;
  const beatportHype = metrics?.beatport_hype_charts ?? 0;
  const shows = metrics?.shows_last_90_days ?? 0;

  return (
    <section className="mt-6 w-full">
      <div className="rounded-3xl border border-[#1f1f23] bg-[#0c0c0e] px-8 py-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Tekkin Rank */}
          <div className="min-w-[240px] flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-tekkin-muted">
                Tekkin Rank
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-5xl font-semibold text-white">
                  {rank.tekkin_score}
                </span>
                <span className="text-sm text-tekkin-muted">/ 100</span>
              </div>
              <p className="mt-1 text-xs text-tekkin-muted">
                Media di Spotify, Beatport e Shows.
              </p>
            </div>
          </div>

          <div className="hidden h-16 w-px bg-[#1f1f23] lg:block" />

          {/* Performance Index */}
          <div className="flex-1">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-tekkin-muted">
                Performance Index
              </span>
              <span className="text-xs font-medium text-lime-400">
                {formLabel}
              </span>
            </div>

            <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-[#111114]">
              <div
                className="h-full rounded-full bg-lime-400"
                style={{ width: `${Math.min(rank.tekkin_score, 100)}%` }}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Spotify */}
              <div className="flex items-center gap-3 rounded-2xl border border-[#1f1f23] bg-[#111114] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 text-xs font-semibold text-black">
                  ♪
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-tekkin-muted">
                    Spotify
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-semibold text-white">
                      {formatNumber(spotifyStreams)}
                    </span>
                    <span className="text-[11px] text-tekkin-muted">streams</span>
                  </div>
                  <span
                    className={`text-[11px] ${
                      spotifyChange.positive ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {spotifyChange.label}
                  </span>
                </div>
              </div>

              {/* Beatport */}
              <div className="flex items-center gap-3 rounded-2xl border border-[#1f1f23] bg-[#111114] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lime-300 text-xs font-semibold text-black">
                  BP
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-tekkin-muted">
                    Beatport
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {beatportCharts} charts
                  </span>
                  <span className="text-[11px] text-tekkin-muted">
                    {beatportHype > 0 ? `${beatportHype} Hype Top 20` : "No Hype charts yet"}
                  </span>
                </div>
              </div>

              {/* Shows */}
              <div className="flex items-center gap-3 rounded-2xl border border-[#1f1f23] bg-[#111114] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500 text-xs font-semibold text-black">
                  🎫
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-tekkin-muted">
                    Shows
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {shows} dates
                  </span>
                  <span className="text-[11px] text-tekkin-muted">Last 90 days</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
