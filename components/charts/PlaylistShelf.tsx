import { ChartPlaylistCard } from "@/components/charts/types";

type PlaylistShelfProps = {
  playlists?: ChartPlaylistCard[];
};

export default function PlaylistShelf({ playlists }: PlaylistShelfProps) {
  const safePlaylists = Array.isArray(playlists) ? playlists : [];

  return (
    <section className="w-full">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40">
          Circuit Playlists
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Playlists</h2>
        <p className="mt-1 text-sm text-white/60">
          Selezione curata direttamente dal backoffice.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto pb-3">
        <div className="flex gap-6">
          {safePlaylists.slice(0, 5).map((p) => (
            <div key={p.id} className="min-w-[280px]">
              <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <p className="mt-3 text-base font-semibold text-white">{p.title}</p>
              <p className="mt-1 text-sm text-white/60">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
