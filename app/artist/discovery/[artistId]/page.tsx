import { ArtistProfileHeader } from "@/components/artist/ArtistProfileHeader";
import { ReleasesHighlights } from "@/components/artist/ReleasesHighlights";
import { TekkinRankSection } from "@/components/artist/TekkinRankSection";
import {
  getArtistDetail,
  type ArtistDetailResponse,
} from "@/lib/artist/discovery/getArtistDetail";
import type { Artist, ArtistRankView } from "@/types/tekkinRank";
import { EditArtistProfileButton } from "../components/EditArtistProfileButton";

type Props = {
  params: Promise<{ artistId: string }>;
};

export default async function ArtistDiscoveryPage({ params }: Props) {
  const { artistId } = await params;

  const detail = await getArtistDetail(artistId);

  const fetchError = detail.error ?? null;

  if (fetchError) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-tekkin-bg">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-tekkin-text">Errore</h1>
          <p className="text-sm text-tekkin-muted">{fetchError}</p>
        </div>
      </main>
    );
  }

  const artist = detail.artist;
  if (!artist) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-tekkin-bg">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-tekkin-text">
            Artista non trovato
          </h1>
          <p className="text-sm text-tekkin-muted">
            Controlla il link o riprova più tardi.
          </p>
        </div>
      </main>
    );
  }

  const genres =
    Array.isArray(artist.main_genres) && artist.main_genres.length > 0
      ? artist.main_genres.filter(Boolean)
      : [];

  const mainGenreLabel = genres[0] ?? null;

  const locationParts = [artist.city, artist.country].filter(Boolean);
  const locationBase =
    locationParts.length > 0 ? locationParts.join(" · ") : null;

  const locationLabel =
    locationBase && artist.open_to_collab
      ? `${locationBase} · Open to collab`
      : locationBase || (artist.open_to_collab ? "Open to collab" : null);

  const instagramUrl = artist.instagram_username
    ? `https://instagram.com/${artist.instagram_username}`
    : null;

  const rankArtist: Artist = {
    id: artist.id,
    artist_name: artist.artist_name ?? "Artista Tekkin",
    artist_photo_url: artist.artist_photo_url,
    artist_genre: mainGenreLabel,
    artist_link_source: undefined,
    spotify_url: artist.spotify_url ?? null,
    beatport_url: artist.beatport_url ?? null,
  };

  const rankView: ArtistRankView | null = detail.rank
    ? { artist: rankArtist, rank: detail.rank as any, metrics: detail.metrics }
    : null;

  const highlightReleases = (detail.releases ?? []).map((rel) => ({
    id: rel.id,
    title: rel.title,
    releaseDate: rel.release_date ?? "",
    coverUrl: rel.cover_url,
    spotifyUrl: rel.spotify_url,
    albumType: rel.album_type,
  }));

  return (
    <main className="flex-1 min-h-screen bg-tekkin-bg px-4 py-8 md:px-10">
      <div className="w-full max-w-5xl mx-auto space-y-8">
        <ArtistProfileHeader
          artistId={artistId}
          artistName={artist.artist_name || "Artista Tekkin"}
          mainGenreLabel={mainGenreLabel}
          locationLabel={locationLabel}
          avatarUrl={artist.artist_photo_url}
          spotifyUrl={artist.spotify_url ?? null}
          beatportUrl={artist.beatport_url ?? null}
          instagramUrl={instagramUrl}
          presskitUrl={artist.presskit_link ?? null}
        />

        <div className="flex justify-center mt-3">
          <EditArtistProfileButton artistId={artist.id} />
        </div>

        <TekkinRankSection overrideData={rankView ?? undefined} />

        <section className="mt-6">
          <ReleasesHighlights releases={highlightReleases} />
        </section>

        {genres.length > 1 && (
          <section className="space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-[0.16em] text-tekkin-muted">
              Generi
            </h2>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
              {genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 rounded-full border border-tekkin-border text-tekkin-muted uppercase tracking-[0.14em]"
                >
                  {genre.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-[0.16em] text-tekkin-muted">
            Bio
          </h2>
          <p className="text-sm leading-relaxed text-tekkin-text/90 whitespace-pre-line">
            {artist.bio_short || "Nessuna bio inserita."}
          </p>
        </section>
      </div>
    </main>
  );
}
