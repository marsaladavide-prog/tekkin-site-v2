"use client";

import { Play } from "lucide-react";
import type { TrackItem } from "@/lib/tracks/types";
import { playTrack } from "@/lib/player/playTrack";

type Variant = "row" | "compact";

export default function TrackRow({
  item,
  variant = "row",
  indexLabel = null,
  showCover = true,
  showArtist = true,
  showMetrics = true,
  onPlay,
  onToggleLike,
  rightSlot,
}: {
  item: TrackItem;
  variant?: Variant;
  indexLabel?: number | string | null;
  showCover?: boolean;
  showArtist?: boolean;
  showMetrics?: boolean;
  onPlay?: (item: TrackItem) => void | Promise<void>;
  onToggleLike?: (item: TrackItem) => void;
  rightSlot?: React.ReactNode;
}) {
  const isCompact = variant === "compact";

  const handlePlay = () => {
    if (onPlay) return onPlay(item);
    return playTrack(item);
  };

  const plays = typeof item.plays === "number" && Number.isFinite(item.plays) ? Math.max(0, Math.floor(item.plays)) : 0;
  const score =
    typeof item.scorePublic === "number" && Number.isFinite(item.scorePublic)
      ? String(Math.round(item.scorePublic))
      : null;

  return (
    <div
      className={[
        "w-full",
        "rounded-2xl",
        "border border-white/10",
        "bg-white/5",
        "hover:bg-white/7",
        "transition-colors",
        isCompact ? "px-3 py-2" : "px-4 py-3",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        {indexLabel !== null && (
          <div className="w-8 text-right text-sm text-[var(--muted)] tabular-nums">{indexLabel}</div>
        )}

        {showCover && (
          <div className={isCompact ? "h-10 w-10" : "h-12 w-12"}>
            {item.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.coverUrl} alt="" className="h-full w-full rounded-xl object-cover" />
            ) : (
              <div className="h-full w-full rounded-xl bg-white/10" />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--fg)]">{item.title}</div>
          {showArtist && (
            <div className="truncate text-xs text-[var(--muted)]">
              {item.artistName ?? ""}
              {item.mixType ? ` · ${item.mixType}` : ""}
            </div>
          )}
        </div>

        {showMetrics && (
          <div className="hidden items-center gap-4 sm:flex">
            <div className="text-xs text-[var(--muted)] tabular-nums">{plays} plays</div>
            {score !== null && <div className="text-xs text-[var(--muted)] tabular-nums">score {score}</div>}
          </div>
        )}

        <div className="flex items-center gap-2">
          {typeof item.likes === "number" && (
            <button
              type="button"
              onClick={() => onToggleLike?.(item)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
              aria-label="Like"
            >
              <span className="text-sm leading-none">{item.liked ? "♥" : "♡"}</span>
              <span className="tabular-nums">{item.likes}</span>
            </button>
          )}
          {rightSlot}
          <button
            type="button"
            onClick={handlePlay}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
            aria-label="Play"
          >
            <Play className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
