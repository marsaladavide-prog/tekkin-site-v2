"use client";


import { ChartSnapshotEntry } from "@/components/charts/types";
import TrackRow from "@/components/tracks/TrackRow";
import { mapChartsAnyToTrackItem } from "@/lib/tracks/mapChartsRowToTrackItem";
import type { TrackItem } from "@/lib/tracks/types";
import { useCallback, useMemo, useState } from "react";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";

type ChartsSplitBoardProps = {
  globalItems?: ChartSnapshotEntry[];
  qualityItems?: ChartSnapshotEntry[];
};

export default function ChartsSplitBoard({ globalItems, qualityItems }: ChartsSplitBoardProps) {
  const safeGlobal = useMemo(() => (Array.isArray(globalItems) ? globalItems : []), [globalItems]);
  const safeQuality = useMemo(() => (Array.isArray(qualityItems) ? qualityItems : []), [qualityItems]);

  console.log("[charts] sample item", safeGlobal?.[0]);

  const play = useTekkinPlayer((s) => s.play);

  // A) Cambia type likesMap
  const [likesMap, setLikesMap] = useState<Record<string, { likedByMe: boolean; likesCount: number }>>({});

  const mergedGlobal = useMemo(() => {
    return safeGlobal.map((t: any) => {
      const vid = (t as any)?.versionId ?? (t as any)?.version_id;
      const local = vid ? likesMap[vid] : null;
      // B) mergedGlobal / mergedQuality
      return local ? { ...t, likedByMe: local.likedByMe, likesCount: local.likesCount } : t;
    });
  }, [safeGlobal, likesMap]);

  const mergedQuality = useMemo(() => {
    return safeQuality.map((t: any) => {
      const vid = (t as any)?.versionId ?? (t as any)?.version_id;
      const local = vid ? likesMap[vid] : null;
      return local ? { ...t, likedByMe: local.likedByMe, likesCount: local.likesCount } : t;
    });
  }, [safeQuality, likesMap]);

  const globalTracks = useMemo(
    () =>
      mergedGlobal
        .map((entry) => ({ entry, track: mapChartsAnyToTrackItem(entry) }))
        .filter((pair): pair is { entry: ChartSnapshotEntry; track: TrackItem } => Boolean(pair.track)),
    [mergedGlobal]
  );

  const qualityTracks = useMemo(
    () =>
      mergedQuality
        .map((entry) => ({ entry, track: mapChartsAnyToTrackItem(entry) }))
        .filter((pair): pair is { entry: ChartSnapshotEntry; track: TrackItem } => Boolean(pair.track)),
    [mergedQuality]
  );

  const handlePlay = useCallback(
    (track: TrackItem, entry?: ChartSnapshotEntry | null) => {
      if (!track.audioUrl || !track.versionId) return;

      play({
        projectId: entry?.project_id ?? track.versionId,
        versionId: track.versionId,
        title: track.title ?? "Untitled",
        subtitle: track.artistName ?? "Tekkin",
        audioUrl: track.audioUrl,
        artistId: track.artistId ?? undefined,
        artistSlug: track.artistSlug ?? undefined,
      });

      fetch("/api/tracks/played", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version_id: track.versionId }),
      }).catch(() => null);
    },
    [play]
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

  const globalRows = useMemo(
    () =>
      globalTracks.map(({ entry, track }, idx) => {
        const v = likesMap[track.versionId];
        const merged = v
          ? { ...track, likesCount: v.likesCount ?? track.likesCount, likedByMe: v.likedByMe ?? track.likedByMe }
          : track;
        return {
          key: `global-${track.versionId}-${entry.rank_position ?? idx}`,
          item: merged,
          entry,
          indexLabel: idx + 1,
          onPlay: () => handlePlay(merged, entry),
        };
      }),
    [globalTracks, handlePlay, likesMap]
  );

  const qualityRows = useMemo(
    () =>
      qualityTracks.map(({ entry, track }, idx) => {
        const v = likesMap[track.versionId];
        const merged = v
          ? { ...track, likesCount: v.likesCount ?? track.likesCount, likedByMe: v.likedByMe ?? track.likedByMe }
          : track;
        return {
          key: `quality-${track.versionId}-${entry.rank_position ?? idx}`,
          item: merged,
          entry,
          indexLabel: idx + 1,
          onPlay: () => handlePlay(merged, entry),
        };
      }),
    [handlePlay, likesMap, qualityTracks]
  );

  return (
    <section className="w-full">
      <div className="grid gap-10 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">
                Global Circuit
              </p>
              <h3 className="text-2xl font-semibold text-white">Top 100 Global</h3>
            </div>
            <span className="text-sm font-medium text-white/60">
              {safeGlobal.length} entries
            </span>
          </div>
          <div className="mt-4 max-h-[520px] overflow-y-auto">
            <div className="flex flex-col gap-2">
              {globalRows.map((row) => (
                <TrackRow
                  key={row.key}
                  item={row.item}
                  indexLabel={row.indexLabel}
                  variant="row"
                  showMetrics
                  onPlay={row.onPlay}
                  onToggleLike={handleToggleLike}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 rounded-full bg-orange-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">
              Tekkin Quality
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {qualityRows.map((row) => (
              <TrackRow
                key={row.key}
                item={row.item}
                indexLabel={row.indexLabel}
                variant="row"
                showMetrics
                onPlay={row.onPlay}
                onToggleLike={handleToggleLike}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
