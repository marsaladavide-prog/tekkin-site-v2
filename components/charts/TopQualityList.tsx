"use client";

import { useState } from "react";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import { getPlayableUrl } from "@/lib/player/getPlayableUrl";
import type { ChartSnapshotEntry } from "./types";

type TopQualityListProps = {
  entries: ChartSnapshotEntry[];
};

export default function TopQualityList({ entries }: TopQualityListProps) {
  const player = useTekkinPlayer();
  const [copiedTrack, setCopiedTrack] = useState<string | null>(null);

  const launchPlayer = async (entry: ChartSnapshotEntry) => {
    const url = await getPlayableUrl(entry.version_id, entry.audio_url ?? null, null);
    if (!url) {
      console.warn("[charts] playable url not resolved", {
        versionId: entry.version_id,
        audio_url: entry.audio_url,
      });
      return;
    }
    player.play({
      projectId: entry.project_id,
      versionId: entry.version_id,
      title: entry.track_title ?? "Tekkin Quality",
      subtitle: entry.artist_name ?? "Tekkin",
      audioUrl: url,
    });
  };

  const handleShare = async (entry: ChartSnapshotEntry) => {
    if (!entry.version_id || typeof window === "undefined" || typeof navigator === "undefined") return;
    const origin = window.location.origin;
    const shareUrl = `${origin}/charts?track=${entry.version_id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedTrack(entry.version_id);
      setTimeout(() => setCopiedTrack(null), 2000);
    } catch (err) {
      console.error("[charts] clipboard error", err);
      setCopiedTrack(null);
    }
  };

  return (
    <section>
      <div className="mb-4 flex items_end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Top 10</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Tekkin Quality</h3>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Solo analyzer</span>
      </div>

      <div className="rounded-2xl border border-slate-900 bg-black/30">
        <div className="divide-y divide-slate-900">
          {entries.map((entry) => {
            const canPlay = Boolean(entry.audio_url);
            return (
              <div
                key={entry.version_id}
                role="button"
                tabIndex={0}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/5"
                onClick={() => void launchPlayer(entry)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void launchPlayer(entry);
                  }
                }}
              >
                <span className="w-5 text-xs font-semibold text-slate-400">{entry.rank_position}</span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{entry.track_title ?? "Untitled"}</p>
                  <p className="truncate text-xs text-slate-400">{entry.artist_name ?? "Tekkin"}</p>
                </div>

                <span className="flex h-7 min-w-[44px] items-center justify_center rounded-full border border-slate-800 bg-black px-2 text-xs font-semibold text-slate-300">
                  {entry.score_public ?? "--"}
                </span>

                <button
                  type="button"
                  className="rounded-full border border-slate-800 bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200 hover:border-slate-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(entry);
                  }}
                >
                  {copiedTrack === entry.version_id ? "Copiato" : "Share"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
