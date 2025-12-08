"use client";

import { useArtistRank } from "../hooks/useArtistRank";

type TekkinRankHighlightCardProps = {
  // opzionale: se vuoi forzare dati specifici
  overrideScore?: number | null;
  overrideLabel?: string | null;
};

export function TekkinRankHighlightCard({
  overrideScore,
  overrideLabel,
}: TekkinRankHighlightCardProps) {
  const { data, loading, error } = useArtistRank();

  if (loading) {
    return (
      <section className="mb-8 rounded-2xl border border-tekkin-border bg-tekkin-panel p-6 text-xs text-tekkin-muted">
        Caricamento Tekkin Rank…
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="mb-8 rounded-2xl border border-tekkin-border bg-tekkin-panel p-6 text-xs text-tekkin-muted">
        Nessun dato Tekkin Rank disponibile al momento.
      </section>
    );
  }

  const { rank, metrics } = data;

  const score = overrideScore ?? rank?.score ?? 0;
  const label = overrideLabel ?? rank?.label ?? "In Growth";

  // metrica base, adattala ai nomi reali dei campi nel tuo hook
  const spotifyStreams = metrics?.spotify_streams ?? 0;
  const spotifyDelta = metrics?.spotify_change_label ?? "+0%";
  const beatportCharts = metrics?.beatport_charts ?? 0;
  const beatportHighlight = metrics?.beatport_highlight ?? "";
  const showsCount = metrics?.shows_count_last_90 ?? 0;

  const scorePercent = Math.max(0, Math.min(100, score));

  return (
    <section className="mb-8">
      <div className="relative overflow-hidden rounded-2xl bg-tekkin-panel border border-tekkin-border shadow-sm">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-tekkin-accent to-transparent opacity-70 animate-[scan_2s_linear_infinite]" />

        <div className="p-6 md:p-7 flex flex-col md:flex-row md:items-center gap-6">
          {/* blocco rank principale */}
          <div className="md:border-r md:border-tekkin-border md:pr-8 flex md:flex-col items-center md:items-start gap-2">
            <span className="text-xs font-mono uppercase tracking-[0.16em] text-tekkin-muted">
              Tekkin Rank
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-black">
                {score}
              </span>
              <span className="text-xs font-mono text-tekkin-muted uppercase tracking-[0.12em]">
                / 100
              </span>
            </div>
            <p className="text-[11px] font-mono text-tekkin-muted mt-1 md:mt-2">
              Media di Spotify, Beatport e Shows.
            </p>
          </div>

          {/* performance + metriche */}
          <div className="flex-1 space-y-4">
            {/* performance bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-tekkin-muted">
                <span className="uppercase tracking-[0.12em]">
                  Performance Index
                </span>
                <span className="text-tekkin-accent font-semibold">
                  {label}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-lime-300 via-tekkin-accent to-tekkin-accent/80 shadow-[0_0_18px_rgba(34,211,238,0.7)]"
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
            </div>

            {/* tre metriche */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              {/* Spotify */}
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#1DB954] flex items-center justify-center text-[11px] font-bold text-black">
                  ♪
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-tekkin-muted">Spotify</div>
                  <div className="text-sm leading-none">
                    {spotifyStreams}
                    <span className="text-[11px] text-tekkin-muted font-normal ml-1">
                      streams
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-300">
                    {spotifyDelta}
                  </div>
                </div>
              </div>

              {/* Beatport */}
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-lime-300 flex items-center justify-center text-[11px] font-bold text-black">
                  BP
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-tekkin-muted">Beatport</div>
                  <div className="text-sm leading-none">
                    {beatportCharts}
                    <span className="text-[11px] text-tekkin-muted font-normal ml-1">
                      charts
                    </span>
                  </div>
                  {beatportHighlight && (
                    <div className="text-[11px] text-tekkin-accent">
                      {beatportHighlight}
                    </div>
                  )}
                </div>
              </div>

              {/* Shows */}
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center text-[11px] font-bold text-white">
                  🎫
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-tekkin-muted">Shows</div>
                  <div className="text-sm leading-none">
                    {showsCount}
                    <span className="text-[11px] text-tekkin-muted font-normal ml-1">
                      dates
                    </span>
                  </div>
                  <div className="text-[11px] text-tekkin-muted">
                    Last 90 days
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
