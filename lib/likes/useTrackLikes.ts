"use client";

import { useCallback, useMemo, useState } from "react";

type LikeState = { liked: boolean; likes: number };
type LikeMap = Record<string, LikeState>;

export function useTrackLikes(initial?: LikeMap) {
  const [map, setMap] = useState<LikeMap>(initial ?? {});

  const get = useCallback(
    (versionId: string) => map[versionId] ?? null,
    [map]
  );

  const apply = useCallback((versionId: string, liked: boolean, likes: number) => {
    setMap((prev) => ({ ...prev, [versionId]: { liked, likes } }));
  }, []);

  const toggle = useCallback(async (versionId: string) => {
    // optimistic: flip subito se esiste
    setMap((prev) => {
      const cur = prev[versionId];
      if (!cur) return prev; // se non abbiamo stato, niente optimistic
      const nextLiked = !cur.liked;
      const nextLikes = Math.max(0, cur.likes + (nextLiked ? 1 : -1));
      return { ...prev, [versionId]: { liked: nextLiked, likes: nextLikes } };
    });

    const res = await fetch("/api/tracks/toggle-like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json) return;

    apply(versionId, Boolean(json.liked), Number(json.likes_count ?? 0));
  }, [apply]);

  return useMemo(() => ({ map, get, apply, toggle }), [map, get, apply, toggle]);
}
