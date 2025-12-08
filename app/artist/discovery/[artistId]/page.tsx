"use client";

import { useEffect, useState } from "react";
import { ArtistProfileHeader } from "@/app/artist/components/ArtistProfileHeader";
import { TekkinRankHighlightCard } from "@/app/artist/components/TekkinRankHighlightCard";

type Artist = {
  id: string;
  artist_name?: string | null;
  artist_photo_url?: string | null;

  // generi principali come array
  main_genres?: string[] | null;

  bio_short?: string | null;
  city?: string | null;
  country?: string | null;
  open_to_collab?: boolean | null;

  // link esterni (allineali ai campi reali della API)
  spotify_url?: string | null;
  beatport_url?: string | null;
  instagram_url?: string | null;
  presskit_link?: string | null;
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
      <main className="flex-1 min-h-screen flex items-center justify-center bg-tekkin-bg">
        <p className="text-sm text-tekkin-muted">Caricamento artista...</p>
      </main>
    );
  }

  if (errorMsg) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-tekkin-bg">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-tekkin-text">Errore</h1>
          <p className="text-sm text-tekkin-muted">{errorMsg}</p>
        </div>
      </main>
    );
  }

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

  // generi visualizzabili
  const displayGenres = Array.isArray(artist.main_genres)
    ? artist.main_genres
        .filter((g): g is string => Boolean(g))
        .map((g) => g.replace(/_/g, " "))
    : [];

  const mainGenreLabel = displayGenres[0] ?? null;
  const locationLabel =
    [artist.city, artist.country].filter(Boolean).join(" · ") || null;

  const locationWithCollab =
    locationLabel && artist.open_to_collab
      ? `${locationLabel} · Open to collab`
      : locationLabel || (artist.open_to_collab ? "Open to collab" : null);

  return (
    <main className="flex-1 min-h-screen bg-tekkin-bg px-4 py-8 md:px-10">
      <div className="w-full max-w-5xl mx-auto space-y-8">
        {/* Header artista + pulsanti esterni */}
        <ArtistProfileHeader
          artistName={artist.artist_name || "Artista senza nome"}
          mainGenreLabel={mainGenreLabel}
          locationLabel={locationWithCollab}
          avatarUrl={artist.artist_photo_url ?? null}
          spotifyUrl={artist.spotify_url ?? null}
          beatportUrl={artist.beatport_url ?? null}
          instagramUrl={artist.instagram_url ?? null}
          presskitUrl={artist.presskit_link ?? null}
          onSendMessage={() => {
            // TODO: apri modal DM / routing a sistema messaggi quando sarà pronto
            console.log("Send message to artist", artist.id);
          }}
        />

        {/* Tekkin Rank highlight per questo artista */}
        <TekkinRankHighlightCard />

        {/* Generi extra se più di uno */}
        {displayGenres.length > 1 && (
          <section className="space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-[0.16em] text-tekkin-muted">
              Generi
            </h2>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
              {displayGenres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 rounded-full border border-tekkin-border text-tekkin-muted uppercase tracking-[0.14em]"
                >
                  {genre}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Bio */}
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
