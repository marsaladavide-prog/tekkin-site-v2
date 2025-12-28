import Image from "next/image";
import Link from "next/link";
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

          <Link
            href="/discovery"
            className="mt-1 inline-block text-sm text-white/60 hover:text-white hover:underline"
          >
            Esplora gli artisti su Circuit
          </Link>

          {periodStart || periodEnd ? (
            <p className="mt-1 text-xs uppercase tracking-[0.35em] text-white/50">
              {periodStart ?? "--"} - {periodEnd ?? "--"}
            </p>
          ) : null}
        </div>

        <Link
          href="/discovery"
          className="text-sm font-medium text-orange-400/90 hover:text-orange-300"
        >
          View more
        </Link>
      </div>

      {hasArtists ? (
        <div className="mt-6 flex gap-10 overflow-x-auto pb-3">
          {safeArtists.map((artist) => {
            const href = artist.slug ? `/@${artist.slug}` : null;

            const card = (
              <div className="min-w-[140px] text-center">
                <div className="mx-auto h-[120px] w-[120px] overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                  {artist.avatarUrl ? (
                    <Image
                      src={artist.avatarUrl}
                      alt={artist.name}
                      width={120}
                      height={120}
                      className="h-full w-full object-cover"
                      sizes="120px"
                    />
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

                <p className="mt-3 text-sm font-semibold text-white">
                  {artist.name}
                </p>
                <p className="mt-1 text-xs text-white/50">
                  {artist.score ? artist.score.toFixed(1) : "--"} pts
                </p>
              </div>
            );

            return href ? (
              <Link
                key={artist.id ?? artist.name}
                href={href}
                className="block hover:brightness-110"
              >
                {card}
              </Link>
            ) : (
              <div key={artist.id ?? artist.name}>{card}</div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 text-sm text-white/60">
          Nessun artista Tekkin registrato risulta in classifica per questo periodo.
        </div>
      )}
    </section>
  );
}
