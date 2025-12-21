"use client";

import { useCallback, useMemo } from "react";
import AnalyzerV2ProPanel from "@/components/analyzer/v2/AnalyzerV2ProPanel";
import TekkinAnalyzerPreviewUi from "@/components/analyzer/TekkinAnalyzerPreviewUi";
import type { AnalyzerPreviewData } from "@/lib/analyzer/previewAdapter";
import type { AnalyzerCompareModel } from "@/lib/analyzer/v2/types";

type AnalyzerUi = "v1" | "v2";

export default function TekkinAnalyzerPageClient({
  ui = "v2",
  versionId,
  track,
  initialData,
  v2Model,
  sharePath,
}: {
  ui?: AnalyzerUi;
  versionId: string;
  track: any;
  initialData: AnalyzerPreviewData;
  v2Model: AnalyzerCompareModel;
  sharePath: string;
}) {
  const reanalyze = useMemo(() => {
    return {
      isLoading: false,
      canRun: true,
      onRun: () => {
        // placeholder: poi lo colleghiamo alla tua action /api/projects/run-analyzer
      },
      versionId: track.versionId,
      projectId: track.artistId ?? "",
      audioUrl: track.audioUrl,
      profileKey: track.profileKey ?? null,
      mode: "master",
      lang: "it",
    };
  }, [track]);

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
    // usa il tuo player globale
  }, []);

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

  if (useV2) {
    return (
      <AnalyzerV2ProPanel
        model={v2Model}
        reanalyze={{
          isLoading: reanalyze.isLoading,
          canRun: reanalyze.canRun,
          onRun: reanalyze.onRun,
        }}
        onPlay={handlePlay}
        onShare={handleShare}
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
