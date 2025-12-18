"use client";

import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import type { TrackItem } from "@/lib/tracks/types";

export function playTrack(item: TrackItem) {
  useTekkinPlayer.getState().play({
    versionId: item.versionId,
    audioUrl: item.audioUrl,
    title: item.title,
    subtitle: item.artistName ?? "",
  });
}