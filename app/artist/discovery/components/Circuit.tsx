// app/artist/discovery/components/Circuit.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TEKKIN_GENRES, formatGenreLabel } from "@/lib/constants/genres";
import { useProfileMe } from "@/app/artist/hooks/useProfileMe";

type CircuitArtist = {
  id: string;
  artist_name: string;
  main_genres: string[];
  city: string | null;
  country: string | null;
  open_to_collab: boolean;
  open_to_promo: boolean;
  artist_photo_url?: string | null;
  tekkin_score?: number | null;
  tekkin_phase?: string | null;
  access_status?: string | null;
  access_plan?: string | null;
  is_subscribed?: boolean;
  created_at?: string | null;
  slug?: string | null;
  artist_slug?: string | null;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Circuit() {
  const [artists, setArtists] = useState<CircuitArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "collab" | "promo" | "both">(
    "all"
  );
  const [minRank, setMinRank] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "name" | "country">(
    "recent"
  );
  const { profile } = useProfileMe();
  const adminUserIds = useMemo(
    () =>
      (process.env.NEXT_PUBLIC_TEKKIN_ADMIN_USER_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    []
  );
  const canSeePrivate = profile?.id
    ? adminUserIds.length === 0 || adminUserIds.includes(profile.id)
    : false;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/artist/discovery");
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
  }, []);

  const filteredArtists = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedMinRank = Number(minRank);

    const filtered = artists.filter((artist) => {
      if (genreFilter) {
        const matchesGenre = Array.isArray(artist.main_genres)
          ? artist.main_genres.includes(genreFilter)
          : false;
        if (!matchesGenre) return false;
      }

      if (typeFilter === "collab" && !artist.open_to_collab) return false;
      if (typeFilter === "promo" && !artist.open_to_promo) return false;
      if (typeFilter === "both" && !(artist.open_to_collab && artist.open_to_promo)) {
        return false;
      }

      if (normalizedSearch) {
        const genreLabel = Array.isArray(artist.main_genres)
          ? artist.main_genres
              .map((genre) => formatGenreLabel(genre))
              .join(" ")
          : "";
        const target = [
          artist.artist_name,
          artist.city,
          artist.country,
          genreLabel,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!target.includes(normalizedSearch)) return false;
      }

      if (!Number.isNaN(normalizedMinRank) && normalizedMinRank > 0) {
        const score = typeof artist.tekkin_score === "number" ? artist.tekkin_score : 0;
        if (score < normalizedMinRank) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === "name") {
        return (a.artist_name || "").localeCompare(b.artist_name || "");
      }

      if (sortMode === "country") {
        return (a.country || "").localeCompare(b.country || "");
      }

      const dateA = a.created_at ? Date.parse(a.created_at) : 0;
      const dateB = b.created_at ? Date.parse(b.created_at) : 0;
      if (dateA !== dateB) return dateB - dateA;
      return (a.artist_name || "").localeCompare(b.artist_name || "");
    });

    return sorted;
  }, [
    artists,
    genreFilter,
    searchTerm,
    typeFilter,
    minRank,
    sortMode,
  ]);

  const subscribedArtists = filteredArtists.filter(
    (artist) => artist.is_subscribed
  );
  const otherArtists = filteredArtists.filter(
    (artist) => !artist.is_subscribed
  );

  const hasActiveFilters =
    genreFilter ||
    searchTerm ||
    typeFilter !== "all" ||
    minRank;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Circuit</h2>
        <p className="text-xs text-muted-foreground">
          Artisti Tekkin attivi con profilo in abbonamento. Filtra per vibe e
          disponibilita.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-tekkin-border bg-tekkin-panel/60 p-3 text-xs md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,200px)_minmax(0,140px)]">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-tekkin-muted">
            Genere Tekkin
          </label>
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="w-full rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 text-xs text-tekkin-text"
          >
            <option value="">Tutti i generi</option>
            {TEKKIN_GENRES.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-tekkin-muted">
            Cerca artista
          </label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nome, genere, citta..."
            className="w-full rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 text-xs text-tekkin-text"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-tekkin-muted">
            Tipo
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="w-full rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 text-xs text-tekkin-text"
          >
            <option value="all">Tutti</option>
            <option value="collab">Collab</option>
            <option value="promo">Promo</option>
            <option value="both">Collab + Promo</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-[0.3em] text-tekkin-muted">
            Rank minimo
          </label>
          <input
            value={minRank}
            onChange={(e) => setMinRank(e.target.value)}
            placeholder="Es. 40"
            inputMode="numeric"
            className="w-full rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 text-xs text-tekkin-text"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 md:col-span-4">
          <button
            type="button"
            onClick={() => setSortMode("recent")}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.3em] transition ${
              sortMode === "recent"
                ? "border-white/40 bg-white/10 text-tekkin-text"
                : "border-tekkin-border text-tekkin-muted"
            }`}
          >
            Recenti
          </button>
          <button
            type="button"
            onClick={() => setSortMode("name")}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.3em] transition ${
              sortMode === "name"
                ? "border-white/40 bg-white/10 text-tekkin-text"
                : "border-tekkin-border text-tekkin-muted"
            }`}
          >
            Nome
          </button>
          <button
            type="button"
            onClick={() => setSortMode("country")}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.3em] transition ${
              sortMode === "country"
                ? "border-white/40 bg-white/10 text-tekkin-text"
                : "border-tekkin-border text-tekkin-muted"
            }`}
          >
            Paese
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setGenreFilter("");
                setSearchTerm("");
                setTypeFilter("all");
                setMinRank("");
              }}
              className="rounded-full border border-tekkin-border px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-tekkin-muted transition hover:text-tekkin-text"
            >
              Reset
            </button>
          )}
          <span className="ml-auto text-[10px] uppercase tracking-[0.3em] text-tekkin-muted">
            {subscribedArtists.length} artisti in circuito
          </span>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Caricamento Circuit...</p>
      )}

      {!loading && subscribedArtists.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nessun artista trovato con questi filtri.
        </p>
      )}

      {!loading && subscribedArtists.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {subscribedArtists.map((artist) => {
            const primaryGenre =
              Array.isArray(artist.main_genres) && artist.main_genres.length > 0
                ? artist.main_genres[0]
                : null;
            const genreLabel = primaryGenre
              ? formatGenreLabel(primaryGenre)
              : "Genere non indicato";

            const slugCandidate = artist.artist_slug ?? artist.slug;
            const artistSlug =
              typeof slugCandidate === "string" && slugCandidate.trim().length > 0
                ? slugCandidate.trim()
                : null;
            const profileHref = artistSlug
              ? `/@${artistSlug}`
              : artist.id
              ? `/artist/discovery/${artist.id}`
              : "/discovery";
            const locationLabel =
              artist.city && artist.country
                ? `${artist.city}, ${artist.country}`
                : artist.country
                ? artist.country
                : artist.city
                ? artist.city
                : "Localita non indicata";
            const initials = getInitials(artist.artist_name || "TK");

            return (
              <Link
                key={artist.id}
                href={profileHref}
                className="group block rounded-lg border border-tekkin-border bg-tekkin-panel/60 p-4 text-sm transition-colors hover:border-tekkin-text/40"
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full border border-tekkin-border bg-tekkin-bg/80">
                    {artist.artist_photo_url ? (
                      <Image
                        src={artist.artist_photo_url}
                        alt={artist.artist_name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-[0.2em] text-tekkin-muted">
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-tekkin-text">
                        {artist.artist_name}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-tekkin-muted">
                        {genreLabel}
                      </span>
                    </div>
                    <div className="text-xs text-tekkin-muted">
                      {locationLabel}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 text-[10px]">
                  {artist.open_to_collab && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                      Collab
                    </span>
                  )}
                  {artist.open_to_promo && (
                    <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-300">
                      Promo
                    </span>
                  )}
                  <span className="rounded-full border border-tekkin-border px-2 py-0.5 text-tekkin-muted">
                    Tekkin {typeof artist.tekkin_score === "number" ? artist.tekkin_score : 0}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && canSeePrivate && otherArtists.length > 0 && (
        <details className="rounded-lg border border-dashed border-tekkin-border/60 bg-tekkin-panel/30 p-4 text-xs text-tekkin-muted">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.4em] text-tekkin-muted">
            Altri profili non in abbonamento ({otherArtists.length})
          </summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {otherArtists.map((artist) => {
              const slugCandidate = artist.artist_slug ?? artist.slug;
              const artistSlug =
                typeof slugCandidate === "string" && slugCandidate.trim().length > 0
                  ? slugCandidate.trim()
                  : null;
              const profileHref = artistSlug
                ? `/@${artistSlug}`
                : artist.id
                ? `/artist/discovery/${artist.id}`
                : "/discovery";

              return (
                <Link
                  key={artist.id}
                  href={profileHref}
                  className="block rounded-md border border-tekkin-border/60 bg-tekkin-bg/60 p-3 text-[11px] text-tekkin-muted transition hover:text-tekkin-text"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{artist.artist_name}</span>
                    <span className="text-[10px] uppercase tracking-[0.3em]">
                      {artist.country || "n/a"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
