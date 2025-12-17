import { ChartTopArtist } from "@/components/charts/types";

type TopArtistsHeroProps = {
  artists?: ChartTopArtist[];
  periodStart?: string | null;
  periodEnd?: string | null;
};

export default function TopArtistsHero({
  artists,
  periodStart,
  periodEnd,
}: TopArtistsHeroProps) {
  const safeArtists = Array.isArray(artists) ? artists : [];
  const hasArtists = safeArtists.length > 0;

  return (
    <section className="w-full">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-400/80">
            Live Circuit
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Top Artists</h2>
          <p className="mt-1 text-sm text-white/60">Esplora gli artisti su Circuit</p>
          {periodStart || periodEnd ? (
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">
              {periodStart ?? "--"} - {periodEnd ?? "--"}
            </p>
          ) : null}
        </div>

        <button className="text-sm font-medium text-orange-400/90 hover:text-orange-300">
          View more
        </button>
      </div>

      {hasArtists ? (
        <div className="mt-6 flex gap-10 overflow-x-auto pb-3">
          {safeArtists.map((artist) => (
            <div key={artist.id ?? artist.name} className="min-w-[140px] text-center">
              <div className="mx-auto h-[120px] w-[120px] overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                {artist.avatarUrl ? (
                  <img src={artist.avatarUrl} alt={artist.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold tracking-[0.25em] text-white/80">
                    {artist.name
                      .split(" ")
                      .map((p) => p.at(0) ?? "")
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm font-semibold text-white">{artist.name}</p>
              <p className="mt-1 text-xs text-white/50">
                {artist.score ? artist.score.toFixed(1) : "--"} pts
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 text-sm text-white/60">
          Nessun artista Tekkin registrato risulta in classifica per questo periodo.
        </div>
      )}
    </section>
  );
}
