"use client";

type SpotifyRelease = {
  id: string;
  title: string;
  releaseDate: string;
  coverUrl: string | null;
  spotifyUrl: string | null;
  albumType: string | null; // "single", "album", "compilation", ecc
};

type ReleasesHighlightsProps = {
  releases: SpotifyRelease[];
};

export function ReleasesHighlights({ releases }: ReleasesHighlightsProps) {
  const hasRealData = releases.length > 0;

  const gradientClasses = [
    "bg-gradient-to-br from-tekkin-primary via-black to-tekkin-accent",
    "bg-gradient-to-br from-slate-200 via-black to-slate-500",
    "bg-gradient-to-br from-orange-400 via-black to-rose-500",
  ];

  function getTypeLabel(albumType?: string | null): string {
    if (!albumType) return "Single";
    const t = albumType.toLowerCase();
    if (t === "single") return "Single";
    if (t === "album") return "Album";
    if (t === "compilation") return "Compilation";
    return "EP";
  }

  function getSubtitle(rel: SpotifyRelease): string {
    if (!rel.releaseDate) return "Spotify";
    try {
      const year = new Date(rel.releaseDate).getFullYear();
      return `Spotify Жњ ${year}`;
    } catch {
      return "Spotify";
    }
  }

  function handlePlayClick(url?: string | null) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Main Releases & Highlights
        </h2>
        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-tekkin-muted">
          <span>Sync: Spotify Жњ Beatport</span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 top-3 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent opacity-60 pointer-events-none"></div>

        <div className="overflow-x-auto pb-2">
          <div className="flex items-stretch gap-4 pt-4">
            {hasRealData
              ? releases.map((rel, idx) => {
                  const gradient =
                    gradientClasses[idx % gradientClasses.length];
                  const typeLabel = getTypeLabel(rel.albumType);

                  return (
                    <div
                      key={rel.id}
                      className="min-w-[150px] max-w-[150px] flex-shrink-0"
                    >
                      <div className="relative rounded-xl overflow-hidden bg-black border border-[var(--border-color)]/90 shadow-md">
                        {rel.coverUrl ? (
                          <div className="aspect-square overflow-hidden">
                            <img
                              src={rel.coverUrl}
                              alt={rel.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={`aspect-square ${gradient} flex items-center justify-center text-xs font-mono text-white text-center px-2`}
                          >
                            {rel.title || "Release"}
                          </div>
                        )}

                        <div className="absolute bottom-2 left-2 flex items-center gap-2">
                          <button
                            className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] hover:bg-tekkin-primary hover:text-black transition-colors"
                            onClick={() => handlePlayClick(rel.spotifyUrl)}
                          >
                            Play
                          </button>
                          <span className="px-2 py-0.5 rounded-full bg-black/80 border border-[var(--border-color)] text-[10px] font-mono uppercase text-tekkin-muted">
                            {typeLabel}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                          {rel.title || "Untitled"}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
                          {getSubtitle(rel)}
                        </p>
                      </div>
                    </div>
                  );
                })
              : (
                <>
                  {/* Fallback static cards se non ci sono ancora release */}
                  <div className="min-w-[150px] max-w-[150px] flex-shrink-0">
                    <div className="relative rounded-xl overflow-hidden bg-black border border-[var(--border-color)]/90 shadow-md">
                      <div className="aspect-square bg-gradient-to-br from-tekkin-primary via-black to-tekkin-accent flex items-center justify-center text-xs font-mono text-white">
                        MIDNIGHT
                      </div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        <button className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] hover:bg-tekkin-primary hover:text-black transition-colors">
                          Play
                        </button>
                        <span className="px-2 py-0.5 rounded-full bg-black/80 border border-[var(--border-color)] text-[10px] font-mono uppercase text-tekkin-muted">
                          Single
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        Midnight Glitch
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
                        Tekkin Records Жњ 2025
                      </p>
                    </div>
                  </div>

                  <div className="min-w-[150px] max-w-[150px] flex-shrink-0">
                    <div className="relative rounded-xl overflow-hidden bg-black border border-[var(--border-color)]/90 shadow-md">
                      <div className="aspect-square bg-gradient-to-br from-slate-200 via-black to-slate-500 flex items-center justify-center text-xs font-mono text-white">
                        EP
                      </div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        <button className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] hover:bg-tekkin-primary hover:text-black transition-colors">
                          Play
                        </button>
                        <span className="px-2 py-0.5 rounded-full bg-black/80 border border-[var(--border-color)] text-[10px] font-mono uppercase text-tekkin-muted">
                          EP
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        Deep State Club
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
                        Beatport Hype
                      </p>
                    </div>
                  </div>

                  <div className="min-w-[150px] max-w-[150px] flex-shrink-0">
                    <div className="relative rounded-xl overflow-hidden bg-black border border-[var(--border-color)]/90 shadow-md">
                      <div className="aspect-square bg-gradient-to-br from-orange-400 via-black to-rose-500 flex items-center justify-center text-xs font-mono text-white">
                        REMIX
                      </div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        <button className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] hover:bg-tekkin-primary hover:text-black transition-colors">
                          Play
                        </button>
                        <span className="px-2 py-0.5 rounded-full bg-black/80 border border-[var(--border-color)] text-[10px] font-mono uppercase text-tekkin-muted">
                          Remix
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        Night Runner
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
                        Support from X, Y
                      </p>
                    </div>
                  </div>
                </>
              )}
          </div>
        </div>
      </div>
    </section>
  );
}
