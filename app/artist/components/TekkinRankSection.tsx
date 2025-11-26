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

function getInitials(name?: string | null): string {
  if (!name) return "??";
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
}

export function TekkinRankSection() {
  const { data: view, loading, error } = useArtistRank();
  const artistRank = view?.metrics;

  if (error) {
    console.error("TekkinRankSection useArtistRank error:", error);
  }

  if (loading) {
    return (
      <section className="mt-6 rounded-3xl border border-[#1f1f23] bg-[#0c0c0e] px-8 py-6 text-sm text-tekkin-muted">
        Carico Tekkin Rank...
      </section>
    );
  }

  // nessun artista caricato
  if (!view) {
    return (
      <section className="mt-6 rounded-3xl border border-[#1f1f23] bg-[#0c0c0e] px-8 py-6 text-sm text-tekkin-muted">
        Nessun dato artista ancora disponibile. Il sistema aggiornerà il tuo profilo dopo il primo sync automatico.
      </section>
    );
  }

  const { rank, metrics, artist } = view;
  const hasMetrics = Boolean(metrics);

  // fallback sicuro per quando metrics è null
  const safeMetrics: {
    spotify_monthly_listeners: number | null;
    spotify_streams_total: number | null;
    spotify_streams_change: number | null;
    spotify_followers: number | null;
    spotify_popularity: number | null;
    beatport_charts: number | null;
    beatport_hype_charts: number | null;
    shows_last_90_days: number | null;
    shows_total: number | null;
    collected_at: string;
  } = metrics ?? {
    spotify_monthly_listeners: null,
    spotify_streams_total: null,
    spotify_streams_change: null,
    spotify_followers: null,
    spotify_popularity: null,
    beatport_charts: null,
    beatport_hype_charts: null,
    shows_last_90_days: null,
    shows_total: null,
    collected_at: "",
  };

  const artistName = artist?.artist_name || "Tekkin Artist";
  const artistPhoto = artist?.artist_photo_url;
  const artistGenre = artist?.artist_genre;
  const artistInitials = getInitials(artistName);
  const formLabel = getFormLabel(rank.tekkin_score);

  const primaryValueRaw =
    safeMetrics.spotify_streams_total ??
    safeMetrics.spotify_followers ??
    safeMetrics.spotify_popularity ??
    0;

  const primaryLabel =
    safeMetrics.spotify_streams_total != null
      ? "Spotify streams totali"
      : safeMetrics.spotify_followers != null
      ? "Follower Spotify"
      : safeMetrics.spotify_popularity != null
      ? "Popularity Spotify"
      : "Spotify";

  const spotifyChange = formatChange(safeMetrics.spotify_streams_change);
  const beatportCharts = safeMetrics.beatport_charts ?? 0;
  const beatportHype = safeMetrics.beatport_hype_charts ?? 0;
  const showsLast90 = safeMetrics.shows_last_90_days ?? 0;
  const showsTotal = safeMetrics.shows_total ?? 0;

  const spotifyDetails = [
    {
      label: "Follower",
      value:
        artistRank?.spotify_followers != null
          ? artistRank.spotify_followers.toLocaleString("it-IT")
          : "n.a.",
    },
    {
      label: "Popularity",
      value:
        artistRank?.spotify_popularity != null ? artistRank.spotify_popularity : "n.a.",
    },
  ];

  console.log("Spotify details dashboard", {
    followers: artistRank?.spotify_followers,
    popularity: artistRank?.spotify_popularity,
  });

  const collectedAt = safeMetrics.collected_at
    ? new Date(safeMetrics.collected_at).toLocaleString("it-IT")
    : "n.d.";

  return (
    <section className="mt-6 w-full">
      <div className="rounded-3xl border border-[#1f1f23] bg-[#0c0c0e] px-8 py-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        <div className="mb-5 flex items-center gap-4 border-b border-[#1f1f23] pb-4">
          <div className="relative h-12 w-12 overflow-hidden rounded-full border border-[#1f1f23] bg-[#0f0f10]">
            {artistPhoto ? (
              <img src={artistPhoto} alt={artistName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500/40 to-teal-500/40 text-sm font-semibold text-white">
                {artistInitials}
              </div>
            )}
            <span className="absolute bottom-1 right-1 rounded-full bg-[#1DB954] px-1 py-[2px] text-[9px] font-black text-black">
              S
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-tekkin-muted">
              Spotify Identity
            </span>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{artistName}</h3>
            </div>
            {artistGenre ? (
              <span className="text-[11px] text-tekkin-muted">{artistGenre}</span>
            ) : null}
          </div>
        </div>

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
                {hasMetrics
                  ? "Media di Spotify, Beatport e Shows."
                  : "Rank provvisorio in attesa del primo sync automatico."}
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
              <div className="group relative flex items-center gap-3 rounded-2xl border border-[#1f1f23] bg-[#111114] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 text-xs font-semibold text-black">
                  &#9835;
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-tekkin-muted">
                    Spotify
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-semibold text-white">
                      {formatNumber(primaryValueRaw)}
                    </span>
                    <span className="text-[11px] text-tekkin-muted">{primaryLabel}</span>
                  </div>
                  <span
                    className={`text-[11px] ${
                      spotifyChange.positive ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {spotifyChange.label}
                  </span>
                </div>

                <div className="pointer-events-none absolute left-0 right-0 top-[110%] hidden rounded-xl border border-[#1f1f23] bg-[#0e0e10] p-4 text-xs text-tekkin-muted shadow-2xl group-hover:block">
                  <div className="mb-1 text-[11px] font-semibold text-white">
                    Dettagli Spotify
                  </div>
                  {loading ? (
                    <div className="text-xs text-white/60">Caricamento Spotify...</div>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {spotifyDetails.map((item) => (
                        <li key={item.label} className="flex justify-between gap-4">
                          <span className="text-white/60">{item.label}</span>
                          <span className="font-medium">{item.value}</span>
                        </li>
                      ))}
                    </ul>
                  )}
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
                  &#127915;
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-tekkin-muted">
                    Shows
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {showsLast90} dates
                  </span>
                  <span className="text-[11px] text-tekkin-muted">
                    Last 90 days (totale {formatNumber(showsTotal)})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-[11px] text-tekkin-muted">
          Ultimo aggiornamento: {collectedAt}
        </div>
      </div>
    </section>
  );
}
