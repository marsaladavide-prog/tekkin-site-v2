"use client";

export function ReleasesHighlights() {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Main Releases & Highlights
        </h2>
        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-tekkin-muted">
          <span>Sync: Spotify · Beatport</span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 top-3 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent opacity-60 pointer-events-none"></div>

        <div className="overflow-x-auto pb-2">
          <div className="flex items-stretch gap-4 pt-4">
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
                  Tekkin Records · 2025
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
          </div>
        </div>
      </div>
    </section>
  );
}
