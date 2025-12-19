// app/artist/discovery/components/Circuit.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TEKKIN_GENRES,
  formatGenreLabel,
} from "@/lib/constants/genres";

type CircuitArtist = {
  id: string;
  artist_name: string;
  main_genres: string[];
  city: string | null;
  country: string | null;
  open_to_collab: boolean;
  open_to_promo: boolean;
  slug?: string | null;
  artist_slug?: string | null;
};

export function Circuit() {
  const [artists, setArtists] = useState<CircuitArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [onlyCollab, setOnlyCollab] = useState(false);
  const [onlyPromo, setOnlyPromo] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (genreFilter) params.set("genre", genreFilter);
        if (onlyCollab) params.set("collab", "true");
        if (onlyPromo) params.set("promo", "true");

        const res = await fetch(`/api/artist/discovery?${params.toString()}`);
        const payload = await res.json();

        if (!res.ok) {
          console.error("Circuit load error", payload);
          setArtists([]);
          return;
        }

        const data = Array.isArray(payload?.artists) ? payload.artists : [];
        setArtists(data);
      } catch (err) {
        console.error("Circuit load error", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [genreFilter, onlyCollab, onlyPromo]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Circuit</h2>
        <p className="text-xs text-muted-foreground">
          Tutti gli artisti iscritti al mondo Tekkin, filtrabili per genere e disponibilità.
        </p>
      </div>

      {/* Filtri Tekkin genres */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <select
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
          className="w-full max-w-xs rounded-md border bg-background px-2 py-1"
        >
          <option value="">Tutti i generi</option>
          {TEKKIN_GENRES.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={onlyCollab}
            onChange={(e) => setOnlyCollab(e.target.checked)}
          />
          <span>Aperti a collab</span>
        </label>

        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={onlyPromo}
            onChange={(e) => setOnlyPromo(e.target.checked)}
          />
          <span>Aperti a promo</span>
        </label>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Caricamento Circuit...</p>}

      {!loading && artists.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nessun artista trovato con questi filtri.
        </p>
      )}

      {!loading && artists.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {artists.map((a) => {
            const primaryGenre =
              Array.isArray(a.main_genres) && a.main_genres.length > 0
                ? a.main_genres[0]
                : null;
            const genreLabel = primaryGenre
              ? formatGenreLabel(primaryGenre)
              : "Genere non indicato";

            const slugCandidate = a.artist_slug ?? a.slug;
            const artistSlug =
              typeof slugCandidate === "string" && slugCandidate.trim().length > 0
                ? slugCandidate.trim()
                : null;
            const profileHref = artistSlug
              ? `/@${artistSlug}`
              : a.id
              ? `/artist/discovery/${a.id}`
              : "/artist/discovery";

            return (
              <Link
                key={a.id}
                href={profileHref}
                className="block rounded-lg border bg-background p-4 text-sm space-y-1 hover:border-primary/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.artist_name}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {genreLabel}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.city && a.country
                    ? `${a.city}, ${a.country}`
                    : a.country
                    ? a.country
                    : "Località non indicata"}
                </div>
                <div className="flex gap-2 pt-2 text-[10px]">
                  {a.open_to_collab && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-500">
                      Collab
                    </span>
                  )}
                  {a.open_to_promo && (
                    <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-500">
                      Promo
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
