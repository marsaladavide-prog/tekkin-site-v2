export default function ArtistExplorePage() {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-tekkin-bg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Explore</h1>
          <p className="text-tekkin-muted text-sm">
            Scopri artisti, reference e selezioni consigliate.
          </p>
        </div>
        <button className="px-3 py-2 rounded bg-tekkin-primary text-black text-sm font-semibold hover:bg-tekkin-accent">
          Suggest Artists
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-tekkin-border bg-tekkin-panel p-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden bg-black border border-tekkin-border">
              <img
                src="https://ui-avatars.com/api/?name=Artist+A&background=000&color=fff"
                alt="Artist A"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="font-semibold text-white">Artist A</div>
              <div className="text-xs text-tekkin-muted">Deep Tech · Berlin</div>
            </div>
          </div>
          <p className="text-sm text-tekkin-muted">
            Mood simile alle tue ultime release.
          </p>
          <button className="text-sm text-tekkin-primary hover:underline">Ascolta ora</button>
        </div>

        <div className="rounded-xl border border-tekkin-border bg-tekkin-panel p-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden bg-black border border-tekkin-border">
              <img
                src="https://ui-avatars.com/api/?name=Artist+B&background=000&color=fff"
                alt="Artist B"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="font-semibold text-white">Artist B</div>
              <div className="text-xs text-tekkin-muted">Minimal · Milano</div>
            </div>
          </div>
          <p className="text-sm text-tekkin-muted">
            Reference consigliata per sound design.
          </p>
          <button className="text-sm text-tekkin-primary hover:underline">Aggiungi ai preferiti</button>
        </div>

        <div className="rounded-xl border border-tekkin-border bg-tekkin-panel p-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden bg-black border border-tekkin-border">
              <img
                src="https://ui-avatars.com/api/?name=Artist+C&background=000&color=fff"
                alt="Artist C"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="font-semibold text-white">Artist C</div>
              <div className="text-xs text-tekkin-muted">Techno · Amsterdam</div>
            </div>
          </div>
          <p className="text-sm text-tekkin-muted">
            Curated set per le tue playlist.
          </p>
          <button className="text-sm text-tekkin-primary hover:underline">Apri selezione</button>
        </div>
      </div>
    </div>
  );
}
