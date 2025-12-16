"use client";

import { useCallback, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";

import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import { getPlayableUrl } from "@/lib/player/getPlayableUrl";

import type { ChartSnapshotEntry } from "./types";

type Top100ListProps = {
  entries: ChartSnapshotEntry[];
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export default function Top100List({ entries }: Top100ListProps) {
  const player = useTekkinPlayer();

  const currentVersionId = useTekkinPlayer((s) => s.versionId);
  const isPlaying = useTekkinPlayer((s) => s.isPlaying);
  const currentTime = useTekkinPlayer((s) => s.currentTime);
  const duration = useTekkinPlayer((s) => s.duration);

  const [copiedTrack, setCopiedTrack] = useState<string | null>(null);

  const rows = useMemo(() => entries ?? [], [entries]);

  const buildPayload = useCallback(
    async (entry: ChartSnapshotEntry) => {
      const url = await getPlayableUrl(
        entry.version_id,
        null, // audio_url http (none here)
        entry.audio_url ?? null // path treated as audio_path
      );

      if (!url) {
        console.warn("[charts] playable url not resolved", {
          versionId: entry.version_id,
          audio_url: entry.audio_url,
        });
        return null;
      }

      const duration =
        typeof (entry as any)?.duration_seconds === "number" && Number.isFinite((entry as any).duration_seconds) && (entry as any).duration_seconds > 0
          ? (entry as any).duration_seconds
          : undefined;

      return {
        projectId: entry.project_id,
        versionId: entry.version_id,
        title: entry.track_title ?? "Untitled",
        subtitle: entry.artist_name ?? "Tekkin",
        audioUrl: url,
        duration,
      };
    },
    []
  );

  const onTogglePlay = useCallback(
    async (entry: ChartSnapshotEntry) => {
      const isThis = currentVersionId === entry.version_id;

      if (isThis) {
        if (isPlaying) {
          player.pause();
        } else {
          player.play(); // riprende senza rigenerare URL
        }
        return;
      }

      const payload = await buildPayload(entry);
      if (!payload) return;

      player.play(payload);
    },
    [buildPayload, currentVersionId, isPlaying, player]
  );

  const onSeekRatio = useCallback(
    async (entry: ChartSnapshotEntry, ratio: number) => {
      const payload = await buildPayload(entry);
      if (!payload) return;

      player.playAtRatio(payload, clamp01(ratio));
    },
    [buildPayload, player]
  );

  const onShare = useCallback(async (entry: ChartSnapshotEntry) => {
    if (!entry.version_id) return;
    if (typeof window === "undefined") return;
    if (typeof navigator === "undefined") return;

    const shareUrl = `${window.location.origin}/charts?track=${entry.version_id}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedTrack(entry.version_id);
      window.setTimeout(() => setCopiedTrack(null), 1800);
    } catch (err) {
      console.error("[charts] clipboard error", err);
      setCopiedTrack(null);
    }
  }, []);

  return (
    <div className="h-[680px] overflow-y-auto rounded-2xl border border-slate-900 bg-black/30">
      <div className="divide-y divide-slate-900">
        {rows.map((entry) => {
          const isThis = currentVersionId === entry.version_id;
          const rowIsPlaying = isThis && isPlaying;

          const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
          const safeTime = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;
          const progress = isThis && safeDuration > 0 ? clamp01(safeTime / safeDuration) : 0;

          return (
            <div
              key={entry.version_id}
              className={[
                "group flex items-center gap-4 px-4 py-3 transition",
                "hover:bg-white/5",
                isThis ? "bg-white/[0.03] ring-1 ring-white/10" : "",
              ].join(" ")}
            >
              <span className="w-6 text-sm font-semibold text-slate-400">{entry.rank_position}</span>

              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-slate-900">
                {entry.cover_url ? (
                  <img
                    src={entry.cover_url}
                    alt={entry.track_title ?? "Tekkin track"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] uppercase text-slate-500">
                    Cover
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => void onTogglePlay(entry)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10"
                aria-label={rowIsPlaying ? "Pause" : "Play"}
              >
                {rowIsPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 translate-x-[1px]" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{entry.track_title ?? "Untitled"}</p>
                <p className="truncate text-xs text-slate-400">{entry.artist_name ?? "Tekkin"}</p>

                <div
                  className="mt-2 h-2 w-full rounded-full bg-white/10 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const r = rect.width > 0 ? x / rect.width : 0;
                    void onSeekRatio(entry, r);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    void onSeekRatio(entry, isThis ? progress : 0);
                  }}
                >
                  <div
                    className="h-2 rounded-full bg-white/35"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </div>

              <span className="flex h-7 min-w-[52px] items-center justify-center rounded-full border border-slate-800 bg-black px-3 text-xs font-semibold text-slate-300">
                {entry.score_public ?? "--"}
              </span>

              <button
                type="button"
                className="rounded-full border border-slate-800 bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200 hover:border-slate-600"
                onClick={(e) => {
                  e.stopPropagation();
                  void onShare(entry);
                }}
              >
                {copiedTrack === entry.version_id ? "Copiato" : "Share"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
