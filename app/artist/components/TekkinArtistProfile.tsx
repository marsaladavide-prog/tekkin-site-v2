"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

export type TekkinArtistProfileProps = {
  artist: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    cover_url?: string | null;
    main_genres?: string[] | null;
    location?: string | null;
    spotify_url?: string | null;
    instagram_url?: string | null;
    beatport_url?: string | null;
    spotify_monthly_listeners?: number | null;
  };
  rank?: {
    overall?: number | null;
  } | null;
};

const TekkinArtistProfile: React.FC<TekkinArtistProfileProps> = ({
  artist,
  rank,
}) => {
  const {
    display_name,
    avatar_url,
    cover_url,
    main_genres,
    location,
    spotify_url,
    instagram_url,
    beatport_url,
    spotify_monthly_listeners,
  } = artist;

  const genres = Array.isArray(main_genres) ? main_genres : [];
  const tekkinRank = rank?.overall ?? null;

  return (
    <section className="w-full overflow-hidden rounded-3xl border border-tekkin-border bg-tekkin-bg">
      {/* COVER ALTA ~320PX IN STILE SPOTIFY */}
      <div className="relative h-[320px] w-full">
        {cover_url ? (
          <Image
            src={cover_url}
            alt={`${display_name} cover`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-[#262626] via-[#151515] to-[#262626]" />
        )}

        {/* fade in basso per leggere il contenuto */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-tekkin-bg via-tekkin-bg/70 to-transparent" />
      </div>

      {/* RIGA SOTTO LA COVER: AVATAR + NOME + INFO + RANK, STILE TEKKIN */}
      <div className="relative -mt-16 flex flex-col gap-6 px-6 pb-6 pt-2 md:flex-row md:items-end md:justify-between md:px-8">
        {/* Sinistra: avatar + testo */}
        <div className="flex items-end gap-4 md:gap-6">
          {/* avatar sovrapposto alla cover */}
          <div className="relative h-28 w-28 flex-shrink-0 rounded-full border border-tekkin-border bg-tekkin-bg shadow-lg shadow-black/60">
            {avatar_url ? (
              <Image
                src={avatar_url}
                alt={display_name}
                fill
                className="rounded-full object-cover"
              />
            ) : (
              <div className="h-full w-full rounded-full bg-[#262626]" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-tekkin-muted">
              Artist
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-tekkin-text md:text-3xl">
              {display_name}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs text-tekkin-muted">
              {location && <span>{location}</span>}
              {genres.map((g) => (
                <span key={g}>· {g.replace(/_/g, " ")}</span>
              ))}
              {typeof spotify_monthly_listeners === "number" && (
                <span>
                  · {spotify_monthly_listeners.toLocaleString()} monthly listeners
                </span>
              )}
            </div>

            {/* link esterni ma in stile Tekkin */}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {spotify_url && (
                <Link
                  href={spotify_url}
                  target="_blank"
                  className="rounded-full border border-tekkin-border px-3 py-1 text-tekkin-muted hover:bg-white hover:text-black"
                >
                  Open on Spotify
                </Link>
              )}
              {beatport_url && (
                <Link
                  href={beatport_url}
                  target="_blank"
                  className="rounded-full border border-tekkin-border px-3 py-1 text-tekkin-muted hover:bg-white hover:text-black"
                >
                  Beatport
                </Link>
              )}
              {instagram_url && (
                <Link
                  href={instagram_url}
                  target="_blank"
                  className="rounded-full border border-tekkin-border px-3 py-1 text-tekkin-muted hover:bg-white hover:text-black"
                >
                  Instagram
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Destra: box Tekkin Rank compatto, in linea col resto della pagina */}
        <div className="flex flex-col items-start gap-3 md:items-end">
          <div className="rounded-2xl border border-tekkin-border bg-tekkin-bg/80 px-4 py-3 text-right">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-tekkin-muted">
              Tekkin Rank
            </div>
            <div className="mt-1 flex items-baseline justify-end gap-1">
              <span className="text-2xl font-semibold text-tekkin-text">
                {tekkinRank != null ? Math.round(tekkinRank) : "–"}
              </span>
              <span className="text-xs text-tekkin-muted">/ 100</span>
            </div>
          </div>

          <button className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-[#e6e6e6]">
            Analyze a track
          </button>
        </div>
      </div>
    </section>
  );
};

export default TekkinArtistProfile;
