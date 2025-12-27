"use client";

import { useEffect, useRef, useState } from "react";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";

type SpotifyRelease = {
  id: string;
  title: string;
  releaseDate: string;
  coverUrl: string | null;
  spotifyUrl: string | null;
  spotifyId?: string | null;
  albumType: string | null; // "single", "album", "compilation", ecc
};

type ReleasesHighlightsProps = {
  releases: SpotifyRelease[];
};

export function ReleasesHighlights({ releases }: ReleasesHighlightsProps) {
  const play = useTekkinPlayer((state) => state.play);
  const previewCacheRef = useRef<Record<string, string | null>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [embedAlbumId, setEmbedAlbumId] = useState<string | null>(null);

  useEffect(() => {
    if (!playError) return undefined;
    const timer = window.setTimeout(() => setPlayError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [playError]);

  const hasRealData = releases.length > 0;

  const gradientClasses = [
    "bg-gradient-to-br from-tekkin-primary via-black to-tekkin-accent",
    "bg-gradient-to-br from-slate-200 via-black to-slate-500",
    "bg-gradient-to-br from-orange-400 via-black to-rose-500",
  ];

  function getTypeLabel(albumType?: string | null): string {
    if (!albumType) return "Single";
    const t = albumType.toLowerCase();
    if (t === "single") return "Single";
    if (t === "album") return "Album";
    if (t === "compilation") return "Compilation";
    return "EP";
  }

  function getSubtitle(rel: SpotifyRelease): string {
    if (!rel.releaseDate) return "Spotify";
    try {
      const year = new Date(rel.releaseDate).getFullYear();
      return `Spotify Жњ ${year}`;
    } catch {
      return "Spotify";
    }
  }

  function extractSpotifyAlbumId(url: string | null): string | null {
    if (!url) return null;
    const match = url.match(/([A-Za-z0-9]{22})/);
    return match ? match[1] : null;
  }

  async function handlePlayClick(rel: SpotifyRelease) {
    console.log("[ReleasesHighlights] play requested", rel);
    setPlayError(null);
    const albumIdToUse = rel.spotifyId ?? extractSpotifyAlbumId(rel.spotifyUrl) ?? null;
    if (!albumIdToUse) return;

    const spotifyUrl = rel.spotifyUrl;
    if (Object.prototype.hasOwnProperty.call(previewCacheRef.current, rel.id)) {
      const cached = previewCacheRef.current[rel.id];
      if (cached) {
        startPlayback(cached, rel);
      } else {
        setPlayError("Anteprima non disponibile per questa release.");
        setEmbedAlbumId(albumIdToUse);
      }
      return;
    }

    setLoadingId(rel.id);
    try {
      const response = await fetch(
        `/api/spotify/preview?albumId=${encodeURIComponent(albumIdToUse)}`
      );
      const payload = (await response.json().catch(() => null)) ?? null;
      const previewUrl = payload?.previewUrl ?? null;
      previewCacheRef.current[rel.id] = previewUrl;

      if (previewUrl) {
        startPlayback(previewUrl, rel, payload?.trackName ?? null);
      } else {
        setPlayError(payload?.error ?? "Anteprima non disponibile per questa release.");
        setEmbedAlbumId(albumIdToUse);
      }
    } catch (err) {
      console.error("[ReleasesHighlights] preview error", err);
      setPlayError("Errore caricando anteprima.");
    } finally {
      setLoadingId((current) => (current === rel.id ? null : current));
    }
  }

  function startPlayback(previewUrl: string, rel: SpotifyRelease, trackName?: string | null) {
    play({
      versionId: rel.id,
      title: trackName ?? rel.title ?? "Release",
      subtitle: rel.title ?? "Release",
      audioUrl: previewUrl,
      coverUrl: rel.coverUrl,
    });
    setEmbedAlbumId(null);
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Main Releases & Highlights
        </h2>
        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-tekkin-muted">
          <span>Sync: Spotify Жњ Beatport</span>
        </div>
      </div>

      {playError ? (
        <div className="mb-2 text-xs text-rose-400">{playError}</div>
      ) : null}

      <div className="relative">
        <div className="absolute inset-x-0 top-3 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent opacity-60 pointer-events-none"></div>

        <div className="overflow-x-auto pb-2">
          <div className="flex items-stretch gap-4 pt-3">
            {hasRealData
              ? releases.map((rel, idx) => {
                  const gradient =
                    gradientClasses[idx % gradientClasses.length];
                  const typeLabel = getTypeLabel(rel.albumType);

                  return (
                    <div
                      key={rel.id}
                      className="min-w-[150px] max-w-[150px] flex-shrink-0"
                    >
                      <div className="relative rounded-xl overflow-hidden bg-black border border-[var(--border-color)]/90 shadow-md">
                        {rel.coverUrl ? (
                          <div className="aspect-square overflow-hidden">
                            <img
                              src={rel.coverUrl}
                              alt={rel.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={`aspect-square ${gradient} flex items-center justify-center text-xs font-mono text-white text-center px-2`}
                          >
                            {rel.title || "Release"}
                          </div>
                        )}

                        <div className="absolute bottom-2 left-2 flex items-center gap-2">
                          <button
                            className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] hover:bg-tekkin-primary hover:text-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            onClick={() => handlePlayClick(rel)}
                            disabled={loadingId === rel.id}
                          >
                            {loadingId === rel.id ? "..." : "Play"}
                          </button>
                          <span className="px-2 py-0.5 rounded-full bg-black/80 border border-[var(--border-color)] text-[10px] font-mono uppercase text-tekkin-muted">
                            {typeLabel}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                          {rel.title || "Untitled"}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
                          {getSubtitle(rel)}
                        </p>
                      </div>
                    </div>
                  );
                })
              : (
                <>
                  {/* Fallback static cards se non ci sono ancora release */}
                  <div className="min-w-[150px] max-w-[150px] flex-shrink-0">
                    <div className="relative rounded-xl overflow-hidden bg-black border border-[var(--border-color)]/90 shadow-md">
                      <div className="aspect-square bg-gradient-to-br from-tekkin-primary via-black to-tekkin-accent flex items-center justify-center text-xs font-mono text-white">
                        MIDNIGHT
                      </div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        <button className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] hover:bg-tekkin-primary hover:text-black transition-colors">
                          Play
                        </button>
                        <span className="px-2 py-0.5 rounded-full bg-black/80 border border-[var(--border-color)] text-[10px] font-mono uppercase text-tekkin-muted">
                          Single
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        Midnight Glitch
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
                        Tekkin Records Жњ 2025
                      </p>
                    </div>
                  </div>

                  <div className="min-w-[150px] max-w-[150px] flex-shrink-0">
                    <div className="relative rounded-xl overflow-hidden bg-black border border-[var(--border-color)]/90 shadow-md">
                      <div className="aspect-square bg-gradient-to-br from-slate-200 via-black to-slate-500 flex items-center justify-center text-xs font-mono text-white">
                        EP
                      </div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        <button className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] hover:bg-tekkin-primary hover:text-black transition-colors">
                          Play
                        </button>
                        <span className="px-2 py-0.5 rounded-full bg-black/80 border border-[var(--border-color)] text-[10px] font-mono uppercase text-tekkin-muted">
                          EP
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        Deep State Club
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
                        Beatport Hype
                      </p>
                    </div>
                  </div>

                  <div className="min-w-[150px] max-w-[150px] flex-shrink-0">
                    <div className="relative rounded-xl overflow-hidden bg-black border border-[var(--border-color)]/90 shadow-md">
                      <div className="aspect-square bg-gradient-to-br from-orange-400 via-black to-rose-500 flex items-center justify-center text-xs font-mono text-white">
                        REMIX
                      </div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        <button className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[11px] hover:bg-tekkin-primary hover:text-black transition-colors">
                          Play
                        </button>
                        <span className="px-2 py-0.5 rounded-full bg-black/80 border border-[var(--border-color)] text-[10px] font-mono uppercase text-tekkin-muted">
                          Remix
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        Night Runner
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-tekkin-muted truncate">
                        Support from X, Y
                      </p>
                    </div>
                  </div>
                </>
              )}
          </div>
        </div>
      </div>
      {embedAlbumId ? (
        <div
          className="fixed inset-0 z-[899] flex items-center justify-center bg-black/70"
          onClick={() => setEmbedAlbumId(null)}
        >
          <div
            className="relative mx-4 w-full max-w-3xl rounded-3xl border border-white/10 bg-black/90 p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEmbedAlbumId(null)}
              className="absolute right-4 top-4 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white"
            >
              Chiudi
            </button>
          <iframe
            title="Spotify preview"
            src={`https://open.spotify.com/embed/album/${embedAlbumId}`}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            className="h-[420px] w-full rounded-2xl border border-white/10"
          />
        </div>
      </div>
    ) : null}
    </section>
  );
}
