"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AnalyzerV2ProPanel from "@/components/analyzer/v2/AnalyzerV2ProPanel";
import TekkinAnalyzerPreviewUi from "@/components/analyzer/TekkinAnalyzerPreviewUi";
import type { AnalyzerPreviewData } from "@/lib/analyzer/previewAdapter";
import type { AnalyzerCompareModel } from "@/lib/analyzer/v2/types";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";

type AnalyzerUi = "v1" | "v2";

export default function TekkinAnalyzerPageClient({
  ui = "v2",
  versionId: _versionId,
  track,
  initialData,
  v2Model,
  sharePath,
}: {
  ui?: AnalyzerUi;
  versionId: string;
track: {
  versionId: string;

  // project/artist
  artistId?: string | null;
  artistSlug?: string | null;
  artistName?: string | null;

  // track metadata
  title?: string | null;
  coverUrl?: string | null;

  // audio
  audioUrl?: string | null;
  profileKey?: string | null;

  // waveform (db)
  waveformPeaks?: unknown;
  waveformBands?: unknown;
  waveformDuration?: number | null;
  createdAt?: string | null;
};

  initialData: AnalyzerPreviewData;
  v2Model: AnalyzerCompareModel;
  sharePath: string;
}) {
  const router = useRouter();
  const player = useTekkinPlayer();
  const currentVersionId = useTekkinPlayer((state) => state.versionId);
  const isPlaying = useTekkinPlayer((state) => state.isPlaying);

  const [reanalyzeStatus, setReanalyzeStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [reanalyzeMessage, setReanalyzeMessage] = useState<string | null>(null);

  const reanalyze = useMemo(() => {
    return {
      isLoading: reanalyzeStatus === "running",
      canRun: true,
      onRun: async () => {
        if (!track?.versionId) return;

        setReanalyzeStatus("running");
        setReanalyzeMessage("Re-analyze in corso...");
        try {
          const res = await fetch("/api/projects/run-analyzer", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              version_id: track.versionId,
              analyzer_version: "v3",
              profile_key: track.profileKey ?? null,
              mode: "master",
              upload_arrays_blob: true,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => null);
            throw new Error(err?.error || "Analyzer failed");
          }

          setReanalyzeStatus("success");
          setReanalyzeMessage("Re-analyze completato");
          router.refresh();
        } catch (err: unknown) {
          setReanalyzeStatus("error");
          const message = err instanceof Error ? err.message : "Errore re-analyze";
          setReanalyzeMessage(message);
        } finally {
          setTimeout(() => {
            setReanalyzeStatus("idle");
            setReanalyzeMessage(null);
          }, 3500);
        }
      },
      versionId: track.versionId,
      projectId: track.artistId ?? "",
      audioUrl: track.audioUrl,
      profileKey: track.profileKey ?? null,
      mode: "master",
      lang: "it",
    };
  }, [reanalyzeStatus, router, track]);

  const uiFromQuery = useMemo<AnalyzerUi | null>(() => {
    if (typeof window === "undefined") return null;
    const v = new URLSearchParams(window.location.search).get("ui");
    if (v === "v1" || v === "v2") return v;
    return null;
  }, []);

  const useV2 = useMemo(() => {
    // priorità: query -> prop server -> env flag
    if (uiFromQuery) return uiFromQuery === "v2";
    if (ui === "v1" || ui === "v2") return ui === "v2";
    return process.env.NEXT_PUBLIC_ANALYZER_UI_V2 === "1";
  }, [uiFromQuery, ui]);

  const handlePlay = useCallback(() => {
    if (!track?.audioUrl || !track?.versionId) return;

    const isActive = currentVersionId === track.versionId;
    if (isActive) {
      useTekkinPlayer.getState().toggle();
      return;
    }

    player.play({
      projectId: track.artistId ?? null,
      versionId: track.versionId,
      title: track.title ?? "Untitled",
      subtitle: track.artistName ?? undefined,
      audioUrl: track.audioUrl,
      duration: track.waveformDuration ?? undefined,
      artistId: track.artistId ?? null,
      artistSlug: track.artistSlug ?? null,
    });
  }, [currentVersionId, player, track]);

  const handleShare = useCallback(async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${sharePath}`
        : sharePath;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // silent
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }, [sharePath]);

  function toNumberArray(value: unknown): number[] | null {
    if (!Array.isArray(value)) return null;
    const out: number[] = [];
    for (const v of value) {
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      out.push(v);
    }
    return out;
  }

  if (useV2) {
    return (
      <AnalyzerV2ProPanel
        model={v2Model}
        reanalyze={{
          isLoading: reanalyze.isLoading,
          canRun: reanalyze.canRun,
          onRun: reanalyze.onRun,
          status: reanalyzeStatus,
          message: reanalyzeMessage,
        }}
        onPlay={handlePlay}
        onShare={handleShare}
        track={{
          versionId: track.versionId,
          projectId: track.artistId ?? null,
          title: track.title ?? "Untitled",
          subtitle: track.artistName ?? undefined,
          audioUrl: track.audioUrl ?? null,
          waveformPeaks: toNumberArray(track.waveformPeaks) ?? undefined,
          waveformBands: track.waveformBands ?? null,
          waveformDuration: track.waveformDuration ?? null,
          createdAt: track.createdAt ?? null,
          isPlaying: currentVersionId === track.versionId && isPlaying,
        }}
      />
    );
  }

  return (
    <TekkinAnalyzerPreviewUi
      initialData={initialData}
      onPlay={handlePlay}
      onShare={handleShare}
    />
  );
}
