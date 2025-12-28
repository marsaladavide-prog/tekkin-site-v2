"use client";

export function ArtistSelection() {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          Artist Selection
          <span className="px-1.5 py-0.5 rounded bg-tekkin-primary/10 border border-tekkin-primary/30 text-[9px] font-mono text-tekkin-primary uppercase tracking-wide">
            Current ID
          </span>
        </h2>
        <div className="text-[11px] font-mono text-zinc-500 dark:text-tekkin-muted">
          Selected by Davide
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 top-3 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent opacity-60 pointer-events-none"></div>

        <div className="overflow-x-auto pb-2">
          <div className="flex items-stretch gap-4 pt-4">
            <div className="min-w-[150px] max-w-[150px] flex-shrink-0">
              <div className="relative rounded-xl overflow-hidden bg-black border border-tekkin-primary/50 shadow-md">
                <div className="aspect-square bg-gradient-to-b from-slate-800 to-black flex items-center justify-center text-xs font-mono text-white">
                  <div className="text-center p-2">
                    <div className="text-[10px] text-tekkin-primary mb-1">CURRENT VIBE</div>
                    <div className="font-bold">Space Motion</div>
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 flex items-center gap-2">
                  <button className="w-7 h-7 rounded-full bg-tekkin-primary text-black flex items-center justify-center text-[11px] hover:scale-110 transition-transform">
                    Play
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                  Minimal Groove 04
                </p>
	                <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
	                  &quot;The inspiration&quot;
	                </p>
              </div>
            </div>

            <div className="min-w-[150px] max-w-[150px] flex-shrink-0">
              <div className="relative rounded-xl overflow-hidden bg-black border border-[var(--border-color)]/90">
                <div className="aspect-square bg-gradient-to-b from-neutral-800 to-black flex items-center justify-center text-xs font-mono text-white">
                  <div className="text-center">
                    <div className="font-bold text-gray-400">CLASSIC</div>
                  </div>
                </div>
                <div className="absolute bottom-2 left-2">
                  <button className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] hover:bg-tekkin-primary hover:text-black transition-colors">
                    Play
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                  Old School Dub
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
                  All-time favorite
                </p>
              </div>
            </div>

            <div className="min-w-[150px] max-w-[150px] flex-shrink-0">
              <div className="relative rounded-xl overflow-hidden bg-black border border-[var(--border-color)]/90">
                <div className="aspect-square bg-gradient-to-b from-neutral-800 to-black flex items-center justify-center text-xs font-mono text-white">
                  <div className="text-center">
                    <div className="font-bold text-gray-400">REFERENCE</div>
                  </div>
                </div>
                <div className="absolute bottom-2 left-2">
                  <button className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] hover:bg-tekkin-primary hover:text-black transition-colors">
                    Play
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                  Deep Textures
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
                  Sound design ref
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
