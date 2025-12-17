// components/artist/Sidebar.tsx
export function ArtistSidebar() {
  return (
    <aside className="w-64 bg-tekkin-panel border-r border-tekkin-border flex flex-col shrink-0 z-20">
      <div className="p-5 flex items-center gap-3">
        <div className="w-8 h-8 bg-tekkin-primary rounded flex items-center justify-center font-bold text-black">
          T
        </div>
        <span className="font-bold text-lg tracking-tight">TEKKIN</span>
      </div>

      <div className="px-4 py-2">
        <div className="text-xs font-mono text-tekkin-muted uppercase mb-2">
          Library
        </div>
        <nav className="space-y-0.5">
          <button className="w-full flex items-center justify-between px-3 py-2 rounded bg-tekkin-primary/10 text-tekkin-primary text-sm font-medium border-l-2 border-tekkin-primary">
            <span>All Tracks</span>
            <span className="text-xs opacity-60">128</span>
          </button>
          <button className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-white/5 text-tekkin-muted hover:text-white text-sm transition-colors">
            <span>Masters</span>
            <span className="text-xs opacity-60">42</span>
          </button>
          <button className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-white/5 text-tekkin-muted hover:text-white text-sm transition-colors">
            <span>Demos / Ideas</span>
            <span className="text-xs opacity-60">15</span>
          </button>
          <button className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-white/5 text-tekkin-muted hover:text-white text-sm transition-colors">
            <span>Archived</span>
            <span className="text-xs opacity-60">800+</span>
          </button>
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-tekkin-border">
        <div className="bg-zinc-900 rounded p-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-tekkin-muted">Storage</span>
            <span className="text-white">45GB / 100GB</span>
          </div>
          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-tekkin-primary w-[45%]" />
          </div>
        </div>
      </div>
    </aside>
  );
}
