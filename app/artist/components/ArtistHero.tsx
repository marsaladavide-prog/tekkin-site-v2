"use client";

import { useMemo } from "react";
import { useArtistRank } from "../hooks/useArtistRank";

type ArtistHeroProps = {
  isDark: boolean;
  onToggleTheme: () => void;
};

export function ArtistHero({ isDark, onToggleTheme }: ArtistHeroProps) {
  const { data } = useArtistRank();

  const artist = data?.artist;
  const artistName = artist?.artist_name || "Tekkin Artist";
  const artistPhoto = artist?.artist_photo_url;
  const artistGenre = artist?.artist_genre || "Artist";
  const spotifyConnected = Boolean(artist?.spotify_id || artist?.spotify_url);
  const spotifyLink =
    artist?.spotify_url ||
    (artist?.spotify_id
      ? `https://open.spotify.com/artist/${artist.spotify_id}`
      : undefined);

console.log("ARTIST HERO:", artist);

  // Social derivati dai campi nuovi del profilo
  const derivedSocials = {
    spotify: spotifyLink,
    beatstats: artist?.beatstats_url,
    beatport: artist?.beatport_url,
    instagram: artist?.instagram_url,
  };

  // Merge con eventuali socials già presenti
  const socials = {
    ...(artist?.socials || {}),
    ...derivedSocials,
  };

  const initials = useMemo(() => {
    return (
      artistName
        .split(" ")
        .filter(Boolean)
        .map((p) => p[0]?.toUpperCase())
        .join("")
        .slice(0, 2) || "??"
    );
  }, [artistName]);

  return (
    <section className="relative px-4 pb-6 pt-2 text-center">
      <div className="absolute right-5 top-5 z-20">
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-full border border-[#1f1f23] text-tekkin-muted hover:text-white hover:border-tekkin-primary transition-colors bg-black/40 backdrop-blur"
          aria-label="Toggle theme"
        >
          <svg
            className={isDark ? "h-5 w-5" : "hidden h-5 w-5"}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
          <svg
            className={isDark ? "hidden h-5 w-5" : "h-5 w-5"}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </button>
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#c9c9c9] bg-[#dcdcdc] px-4 py-1 text-[11px] font-mono uppercase tracking-[0.14em] text-[#3a3a3a] shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
          <span className="h-2 w-2 rounded-full bg-lime-400" />
          Tekkin Artist Profile
        </div>

        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[#1f1f23] bg-[#0f0f10] text-2xl font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            {artistPhoto ? (
              <img
                src={artistPhoto}
                alt={artistName}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight text-white">
              {artistName}
            </h1>
            <p className="text-xs md:text-sm font-mono uppercase tracking-[0.18em] text-tekkin-muted">
              {artistGenre}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button className="flex items-center gap-2 rounded-full bg-tekkin-primary px-5 py-2 text-xs font-bold uppercase text-black shadow-[0_12px_30px_rgba(6,182,212,0.35)] transition-transform hover:-translate-y-0.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4 20-7z" />
            </svg>
            Send Message
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1f1f23] bg-transparent text-tekkin-muted hover:border-red-500 hover:text-red-400 transition-colors"
            title="Add to Favorites"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1f1f23] bg-transparent text-tekkin-muted hover:border-tekkin-primary hover:text-tekkin-primary transition-colors"
            title="Vote Artist"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1f1f23] bg-transparent text-tekkin-muted hover:border-tekkin-primary hover:text-tekkin-primary transition-colors"
            title="Share Profile"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-3 text-[11px] font-mono">
          {[
            {
              key: "spotify",
              label: "Spotify",
              value: socials.spotify,
              badge: "S",
              color: "bg-[#1DB954]",
            },
            {
              key: "beatstats",
              label: "Beatstats",
              value: socials.beatstats,
              badge: "BS",
              color: "bg-lime-300",
            },
            {
              key: "beatport",
              label: "Beatport",
              value: socials.beatport,
              badge: "BP",
              color: "bg-lime-300",
            },
            {
              key: "instagram",
              label: "Instagram",
              value: socials.instagram,
              badge: "IG",
              color: "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
            },
          ].map((item) => {
            const active =
              item.key === "spotify" ? spotifyConnected : Boolean(item.value);
            const Wrapper: any = active ? "a" : "div";
            return (
              <Wrapper
                key={item.key}
                href={active ? (item.value as string) : undefined}
                target={active ? "_blank" : undefined}
                rel={active ? "noreferrer" : undefined}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 transition-colors ${
                  active
                    ? "border-tekkin-primary/80 bg-[#0f0f10] text-white hover:border-tekkin-primary"
                    : "border-[#1f1f23] bg-transparent text-tekkin-muted"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                    active ? item.color + " text-black" : "bg-[#1f1f23] text-[#6b6b6b]"
                  }`}
                >
                  {item.badge}
                </span>
                <div className="flex flex-col leading-[1.1]">
                  <span>{item.label}</span>
                  <span
                    className={`text-[10px] ${
                      active ? "text-emerald-400" : "text-tekkin-muted"
                    }`}
                  >
                    {active ? "Attivo" : "Non collegato"}
                  </span>
                </div>
              </Wrapper>
            );
          })}
        </div>
      </div>
    </section>
  );
}
