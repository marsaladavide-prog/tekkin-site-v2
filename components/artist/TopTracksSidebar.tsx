"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TrackRow from "@/components/tracks/TrackRow";
import type { TrackItem } from "@/lib/tracks/types";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";

type TopTrackItem = TrackItem & { rankPosition: number };

type Props = {
  tracks: TopTrackItem[];
  artistId: string;
};

export default function TopTracksSidebar({ tracks, artistId }: Props) {
  const play = useTekkinPlayer((s) => s.play);
  const [likesMap, setLikesMap] = useState<Record<string, { likedByMe: boolean; likesCount: number }>>({});
  const [trendMap, setTrendMap] = useState<Record<string, number>>({});
  const [signedCache, setSignedCache] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const next: Record<string, { likedByMe: boolean; likesCount: number }> = {};
    tracks.forEach((t) => {
      if (typeof t.likesCount === "number") {
        next[t.versionId] = {
          likedByMe: Boolean(t.likedByMe),
          likesCount: t.likesCount ?? 0,
        };
      }
    });
    setLikesMap(next);
  }, [tracks]);

  useEffect(() => {
    const storageKey = `tekkin_artist_top10_${artistId}`;
    let previous: Record<string, number> = {};

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) previous = JSON.parse(raw);
    } catch {
      previous = {};
    }

    const next: Record<string, number> = {};
    const deltas: Record<string, number> = {};

    tracks.forEach((t) => {
      const prevPos = previous[t.versionId];
      deltas[t.versionId] = typeof prevPos === "number" ? prevPos - t.rankPosition : 0;
      next[t.versionId] = t.rankPosition;
    });

    setTrendMap(deltas);

    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, [artistId, tracks]);

  const mergedTracks = useMemo(
    () =>
      tracks.map((t) => {
        const local = likesMap[t.versionId];
        return local
          ? { ...t, likesCount: local.likesCount, likedByMe: local.likedByMe }
          : t;
      }),
    [likesMap, tracks]
  );

  const ensureAudioUrl = useCallback(
    async (track: TrackItem) => {
      if (track.audioUrl) return track.audioUrl;
      if (Object.prototype.hasOwnProperty.call(signedCache, track.versionId)) {
        return signedCache[track.versionId];
      }
      const res = await fetch("/api/storage/sign-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: track.versionId }),
      });
      if (!res.ok) return null;
      const json = (await res.json().catch(() => null)) as { audio_url?: string } | null;
      const url = typeof json?.audio_url === "string" ? json.audio_url : null;
      setSignedCache((prev) => ({ ...prev, [track.versionId]: url }));
      return url;
    },
    [signedCache]
  );

  const handlePlay = useCallback(
    async (track: TrackItem) => {
      if (!track.versionId) return;
      const audioUrl = await ensureAudioUrl(track);
      if (!audioUrl) return;

      play({
        projectId: track.projectId ?? track.versionId,
        versionId: track.versionId,
        title: track.title ?? "Untitled",
        subtitle: track.artistName ?? "Tekkin",
        collabBadges: track.collabBadges ?? null,
        audioUrl,
        artistId: track.artistId ?? undefined,
        artistSlug: track.artistSlug ?? undefined,
      });

      fetch("/api/tracks/played", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version_id: track.versionId }),
      }).catch(() => null);
    },
    [ensureAudioUrl, play]
  );

  const handleToggleLike = useCallback(async (versionId: string) => {
    if (!versionId) return;

    setLikesMap((prev) => {
      const current = prev[versionId] ?? { likedByMe: false, likesCount: 0 };
      const nextLiked = !current.likedByMe;
      const nextLikes = Math.max(0, current.likesCount + (nextLiked ? 1 : -1));
      return { ...prev, [versionId]: { likedByMe: nextLiked, likesCount: nextLikes } };
    });

    const res = await fetch("/api/tracks/toggle-like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json) return;

    setLikesMap((prev) => ({
      ...prev,
      [versionId]: {
        likedByMe: Boolean((json as any)?.liked),
        likesCount: Number((json as any)?.likes_count ?? 0),
      },
    }));
  }, []);

  return (
    <aside className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-[0.16em] text-tekkin-muted">
            Top 10 tracce
          </h3>
          <span className="text-[10px] text-white/40">Tekkin Quality</span>
        </div>
        <p className="mt-2 text-[11px] text-white/50">
          Classifica = score Tekkin Rank (quality). Pareggio: traccia piu recente.
        </p>
        <p className="text-[10px] text-white/35">
          Frecce: variazione rispetto alla tua ultima visita.
        </p>

        {mergedTracks.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            {mergedTracks.map((track) => {
              const trend = trendMap[track.versionId] ?? 0;
              const trendSlot =
                trend > 0 ? (
                  <span className="text-emerald-300">^</span>
                ) : trend < 0 ? (
                  <span className="text-rose-300">v</span>
                ) : (
                  <span className="text-white/30">-</span>
                );

              return (
                <TrackRow
                  key={`artist-top-${track.versionId}-${track.rankPosition}`}
                  item={track}
                  indexLabel={track.rankPosition}
                  variant="compact"
                  showArtist={false}
                  showMetrics
                  onPlay={() => handlePlay(track)}
                  onToggleLike={handleToggleLike}
                  rightSlot={<div className="text-xs font-semibold">{trendSlot}</div>}
                />
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-xs text-tekkin-muted">
            Nessuna traccia pubblica: la top 10 apparira qui.
          </p>
        )}
      </div>
    </aside>
  );
}
