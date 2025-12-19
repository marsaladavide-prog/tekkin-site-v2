"use client";

import { useEffect, useState } from "react";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import Link from "next/link";

export function FloatingPlayer() {
  const {
    isPlaying,
    versionId,
    artistId,
    artistSlug,
    title,
    subtitle,
    coverUrl,
    toggle,
    play,
    pause,
  } = useTekkinPlayer();

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-72 flex-col gap-2 rounded-2xl bg-black/80 p-4 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 overflow-hidden rounded-2xl">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`Cover ${title}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-white/60 text-xs">
              <span>Cover</span>
              <span>mancante</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">{title}</div>
          {artistSlug ? (
            <Link
              href={`/@${artistSlug}`}
              className="text-xs text-white/60 hover:underline"
            >
              {subtitle}
            </Link>
          ) : (
            <div className="text-xs text-white/60">{subtitle}</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-white/10"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6h4v12h-4z"
              />
            </svg>
          )}
        </button>

        <Link
          href={`/artist/discovery/${artistId}`}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
          aria-label="Go to artist profile"
        >
          <span className="text-sm leading-none">Artista</span>
        </Link>
      </div>
    </div>
  );
}