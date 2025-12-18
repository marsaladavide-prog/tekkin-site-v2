"use client";

import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import type { TrackItem } from "@/lib/tracks/types";

export function playTrack(item: TrackItem) {
  if (!item.audioUrl) return;

  const st = useTekkinPlayer.getState();

  st.open({
    versionId: item.versionId,
    audioUrl: item.audioUrl,
    title: item.title,
    subtitle: item.artistName ?? "",
    artistId: item.artistId ?? undefined,
    artistSlug: item.artistSlug ?? undefined,
  });

  st.play();
}
