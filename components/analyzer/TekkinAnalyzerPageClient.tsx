"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import TekkinAnalyzerPreviewUi from "@/components/analyzer/TekkinAnalyzerPreviewUi";
import AnalyzerV2Panel from "@/components/analyzer/v2/AnalyzerV2Panel";
import { playTrack } from "@/lib/player/playTrack";
import type { TrackItem } from "@/lib/tracks/types";
import type { AnalyzerPreviewData } from "@/lib/analyzer/previewAdapter";
import type { AnalyzerCompareModel } from "@/lib/analyzer/v2/types";

type Props = {
  initialData: AnalyzerPreviewData;
  v2Model: AnalyzerCompareModel;
  track: {
    versionId: string;
    title: string;
    artistName: string | null;
    coverUrl: string | null;
    audioUrl: string | null;
    artistId?: string | null;
    artistSlug?: string | null;
  };
  sharePath: string; // es: /v/<versionId>
};

export default function TekkinAnalyzerPageClient({ initialData, v2Model, track, sharePath }: Props) {
  const sp = useSearchParams();

  const useV2 = useMemo(() => {
    const q = sp?.get("ui");
    if (q === "v2") return true;
    if (q === "v1") return false;
    return process.env.NEXT_PUBLIC_ANALYZER_UI_V2 === "true";
  }, [sp]);

  const handlePlay = useCallback(() => {
    const item: TrackItem = {
      versionId: track.versionId,
      title: track.title,
      artistName: track.artistName ?? null,
      coverUrl: track.coverUrl ?? null,
      audioUrl: track.audioUrl,
      artistId: track.artistId ?? null,
      artistSlug: track.artistSlug ?? null,
      likesCount: 0,
      likedByMe: false,
    };

    if (!item.audioUrl) return;
    playTrack(item);
  }, [track]);

  const handleShare = useCallback(async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}${sharePath}` : sharePath;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // silent
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }, [sharePath]);

  if (useV2) {
    return <AnalyzerV2Panel model={v2Model} onPlay={handlePlay} onShare={handleShare} />;
  }

  return <TekkinAnalyzerPreviewUi initialData={initialData} onPlay={handlePlay} onShare={handleShare} />;
}
