"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import TrackRow from "@/components/tracks/TrackRow";
import type { TrackItem } from "@/lib/tracks/types";

type Props = { initialItems: TrackItem[] };

type LikesMap = Record<string, { count: number; liked: boolean }>;

export default function ProjectsClient({ initialItems }: Props) {
  const [items, setItems] = useState<TrackItem[]>(initialItems);

  const versionIds = useMemo(
    () => Array.from(new Set(initialItems.map((i) => i.versionId))).filter(Boolean),
    [initialItems]
  );

  // 1) batch init likes
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
          if (!row) return it;
          return { ...it, likesCount: row.count, likedByMe: row.liked };
        })
      );
    })();

    return () => controller.abort();
  }, [versionIds]);

  // 2) optimistic toggle
  const onToggleLike = useCallback(async (versionId: string) => {
    let nextLiked = false;

    setItems((prev) =>
      prev.map((it) => {
        if (it.versionId !== versionId) return it;
        nextLiked = !it.likedByMe;
        const nextCount = it.likesCount + (nextLiked ? 1 : -1);
        return { ...it, likedByMe: nextLiked, likesCount: Math.max(0, nextCount) };
      })
    );

    const res = await fetch("/api/tracks/toggle-like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId }),
    });

    if (!res.ok) {
      // rollback se fallisce
      setItems((prev) =>
        prev.map((it) => {
          if (it.versionId !== versionId) return it;
          const rollbackLiked = !it.likedByMe;
          const rollbackCount = it.likesCount + (rollbackLiked ? 1 : -1);
          return { ...it, likedByMe: rollbackLiked, likesCount: Math.max(0, rollbackCount) };
        })
      );
      return;
    }

    // opzionale: se la tua API ritorna count/liked definitivi, qui sincronizzi
    // const json = await res.json().catch(() => null);
  }, []);

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <TrackRow
          key={it.versionId}
          item={it}
          onToggleLike={() => onToggleLike(it.versionId)}
        />
      ))}
    </div>
  );
}
