"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import TrackRow from "@/components/tracks/TrackRow";
import { playTrack } from "@/lib/player/playTrack";
import type { TrackItem } from "@/lib/tracks/types";

type Props = { initialItems: TrackItem[] };
type LikesMap = Record<string, { count: number; liked: boolean }>;

export default function PublicArtistClient({ initialItems }: Props) {
  const [items, setItems] = useState<TrackItem[]>(initialItems);

  const versionIds = useMemo(
    () => Array.from(new Set(initialItems.map((i) => i.versionId))).filter(Boolean),
    [initialItems]
  );

  // batch init likes
  useEffect(() => {
    if (versionIds.length === 0) return;
    const controller = new AbortController();

    (async () => {
      const qs = encodeURIComponent(versionIds.join(","));
      const res = await fetch(`/api/tracks/likes?version_ids=${qs}`, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) return;

      const json = (await res.json().catch(() => null)) as { map?: LikesMap } | null;
      const map = json?.map ?? {};

      setItems((prev) =>
        prev.map((it) => {
          const row = map[it.versionId];
          return row ? { ...it, likesCount: row.count, likedByMe: row.liked } : it;
        })
      );
    })();

    return () => controller.abort();
  }, [versionIds]);

  // toggle like optimistic
  const onToggleLike = useCallback(async (versionId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.versionId !== versionId
          ? it
          : {
              ...it,
              likedByMe: !it.likedByMe,
              likesCount: Math.max(0, it.likesCount + (it.likedByMe ? -1 : 1)),
            }
      )
    );

    const res = await fetch("/api/tracks/toggle-like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId }),
    });

    if (!res.ok) {
      // rollback
      setItems((prev) =>
        prev.map((it) =>
          it.versionId !== versionId
            ? it
            : {
                ...it,
                likedByMe: !it.likedByMe,
                likesCount: Math.max(0, it.likesCount + (it.likedByMe ? -1 : 1)),
              }
        )
      );
    }
  }, []);

  // play with signed url
  const onPlay = useCallback(async (item: TrackItem) => {
    if (item.audioUrl) {
      playTrack(item);
      return;
    }

    const res = await fetch("/api/storage/sign-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: item.versionId }),
    });

    if (!res.ok) return;
    const json = (await res.json().catch(() => null)) as { audio_url?: string } | null;
    if (!json?.audio_url) return;

    playTrack({ ...item, audioUrl: json.audio_url });
  }, []);

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <TrackRow
          key={it.versionId}
          item={it}
          onPlay={onPlay}
          onToggleLike={onToggleLike}
        />
      ))}
    </div>
  );
}
