"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Artist = {
  id: string;
  artist_name?: string | null;
  artist_photo_url?: string | null;

  // niente più artist_genre, niente più main_genre
  main_genres?: string[] | null;
  bio_short?: string | null;

  city?: string | null;
  country?: string | null;
  open_to_collab?: boolean | null;
};

type Props = {
  // con Next 15 i params sono una Promise
  params: Promise<{ artistId: string }>;
};

export default function ArtistDetailPage({ params }: Props) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { artistId } = await params;

        const res = await fetch(`/api/artist/discovery/${artistId}`);
        const text = await res.text();

        let data: any = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            console.error("Artist detail non JSON:", text);
          }
        }

        if (!res.ok) {
          console.error("Artist detail error:", {
            status: res.status,
            data,
            text,
          });

          if (!cancelled) {
            const message =
              data?.error ??
              (res.status === 404
                ? "Artista non trovato."
                : "Errore caricando l'artista.");

            setErrorMsg(message);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          // la route restituisce { artist: {...} }
          setArtist(data?.artist ?? null);
          setLoading(false);
        }
      } catch (err) {
        console.error("Artist detail unexpected error:", err);
        if (!cancelled) {
          setErrorMsg("Errore inatteso caricando l'artista.");
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [params]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Caricamento artista...</p>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Errore</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
      </main>
    );
  }

  if (!artist) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Artista non trovato</h1>
          <p className="text-sm text-muted-foreground">
            Controlla il link o riprova più tardi.
          </p>
        </div>
      </main>
    );
  }

  // prendo i generi dall'array main_genres
  const displayGenres = Array.isArray(artist.main_genres)
    ? artist.main_genres
        .filter((g): g is string => Boolean(g))
        .map((g) => g.replace(/_/g, " "))
    : [];

  return (
    <main className="min-h-screen px-4 py-10 flex justify-center">
      <div className="w-full max-w-3xl space-y-8">
        <section className="flex gap-6 items-start">
          {/* avatar: se c'è artist_photo_url usiamo l'immagine, altrimenti le iniziali */}
          {artist.artist_photo_url ? (
            <div className="relative w-28 h-28 rounded-full overflow-hidden border border-neutral-800 flex-shrink-0">
              <Image
                src={artist.artist_photo_url}
                alt={artist.artist_name || "Artist photo"}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-28 h-28 rounded-full border border-neutral-800 flex-shrink-0 flex items-center justify-center text-xl font-semibold">
              {(artist.artist_name ?? "?").slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="flex-1 space-y-2">
            <h1 className="text-2xl font-semibold">
              {artist.artist_name || "Artista senza nome"}
            </h1>

            <div className="text-sm text-muted-foreground flex flex-wrap gap-2">
              {displayGenres.length > 0 &&
                displayGenres.map((genre) => (
                  <span
                    key={genre}
                    className="px-2 py-1 rounded-full border border-neutral-700 text-xs uppercase tracking-wide"
                  >
                    {genre}
                  </span>
                ))}

              {(artist.city || artist.country) && (
                <span>
                  {artist.city}
                  {artist.city && artist.country ? " · " : ""}
                  {artist.country}
                </span>
              )}

              {artist.open_to_collab && (
                <span className="px-2 py-1 rounded-full border border-emerald-500/70 text-xs">
                  Open to collab
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            Bio
          </h2>

          <p className="text-sm leading-relaxed text-neutral-200 whitespace-pre-line">
            {artist.bio_short || "Nessuna bio inserita."}
          </p>
        </section>
      </div>
    </main>
  );
}
