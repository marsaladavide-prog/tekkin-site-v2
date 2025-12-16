import Link from "next/link";
import type { TopArtistSummary } from "./types";

type TopArtistsRowProps = {
  artists: TopArtistSummary[];
};

function getInitials(name: string | null): string {
  if (!name) return "TK";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function TopArtistsRow({ artists }: TopArtistsRowProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify_between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Top Artists
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">Artisti in classifica</h2>
        </div>

        <Link
          className="rounded-full border border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 hover:border-slate-600 hover:text-white"
          href="/artist/discovery"
        >
          Esplora su Circuit
        </Link>
      </div>

      {artists.length === 0 ? (
        <div className="rounded-2xl border border-slate-900 bg-black/30 p-5 text-sm text-slate-400">
          Nessun artista al momento
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto rounded-2xl border border-slate-900 bg-black/30 p-4">
          {artists.map((artist) => {
            const avatar = artist.ig_profile_picture ?? artist.artist_photo_url ?? null;
            return (
              <Link
                key={artist.id}
                href={`/artist/discovery/${artist.id}`}
                className="flex w-[92px] shrink-0 flex-col items-center gap-2 text-center"
              >
                <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-900">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={artist.artist_name ?? "Tekkin artist"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-200">
                      {getInitials(artist.artist_name)}
                    </div>
                  )}
                </div>
                <p className="w-full truncate text-xs font-semibold text-slate-300">
                  {artist.artist_name ?? "Artist"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
