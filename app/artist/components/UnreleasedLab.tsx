"use client";

export function UnreleasedLab() {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
          Unreleased / Lab
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
        </h2>
        <div className="text-[11px] font-mono text-zinc-500 dark:text-tekkin-muted">
          Private & Demos
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 top-3 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent opacity-60 pointer-events-none"></div>

        <div className="overflow-x-auto pb-2">
          <div className="flex items-stretch gap-4 pt-4">
            <div className="min-w-[150px] max-w-[150px] flex-shrink-0">
              <div className="relative rounded-xl overflow-hidden bg-black border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxjaXJjbGUgY3g9IjIiIGN5PSIyIiByPSIxIiBmaWxsPSIjZmZmIiAvPjwvc3ZnPg==')]"></div>
                <div className="aspect-square flex flex-col items-center justify-center text-xs font-mono text-white z-10 relative">
                  <div className="text-[30px] text-red-500 font-bold mb-1">?</div>
                  <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] border border-red-500/30">
                    LATEST ID
                  </span>
                </div>
                <div className="absolute bottom-2 left-2 flex items-center gap-2 z-20">
                  <button className="w-7 h-7 rounded-full bg-tekkin-text text-black flex items-center justify-center text-[11px] hover:bg-red-500 hover:text-white transition-colors">
                    Play
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                  ID - Unknown Logic
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
                  Sent to Label
                </p>
              </div>
            </div>

            <div className="min-w-[150px] max-w-[150px] flex-shrink-0 opacity-70">
              <div className="relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-black border border-[var(--border-color)]/50">
                <div className="aspect-square bg-zinc-100 dark:bg-[#0f0f0f] flex items-center justify-center text-xs font-mono text-zinc-400 dark:text-tekkin-muted">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs font-semibold text-zinc-500 dark:text-tekkin-muted truncate">
                  WIP Project 02
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-tekkin-muted/60 truncate">
                  In progress
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
