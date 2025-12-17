"use client";

"use client";

import { ChartSnapshotEntry } from "@/components/charts/types";
import { Play } from "lucide-react";
import { useCallback } from "react";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";

type ChartsSplitBoardProps = {
  globalItems?: ChartSnapshotEntry[];
  qualityItems?: ChartSnapshotEntry[];
};

export default function ChartsSplitBoard({
  globalItems,
  qualityItems,
}: ChartsSplitBoardProps) {
  const safeGlobal = Array.isArray(globalItems) ? globalItems : [];
  const safeQuality = Array.isArray(qualityItems) ? qualityItems : [];

  const player = useTekkinPlayer();

  const handlePlay = useCallback(
    (entry: ChartSnapshotEntry) => {
      if (!entry.audio_url) return;
      player.open({
        projectId: entry.project_id,
        versionId: entry.version_id,
        title: entry.track_title ?? "Untitled",
        subtitle: entry.artist_name ?? "Tekkin",
        audioUrl: entry.audio_url,
      });

      if (entry.version_id) {
        fetch("/api/tracks/played", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version_id: entry.version_id }),
        }).catch(() => null);
      }
    },
    [player]
  );

  return (
    <section className="w-full">
      <div className="grid gap-10 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">
                Global Circuit
              </p>
              <h3 className="text-2xl font-semibold text-white">Top 100 Global</h3>
            </div>
            <span className="text-sm font-medium text-white/60">
              {safeGlobal.length} entries
            </span>
          </div>
          <div className="mt-4 max-h-[520px] overflow-y-auto">
            <div className="divide-y divide-white/10">
              {safeGlobal.map((item) => (
                <div
                  key={`global-${item.version_id ?? item.rank_position}`}
                  className="flex items-center justify-between gap-3 px-2 py-3 transition hover:bg-white/5"
                >
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handlePlay(item)}
                      disabled={!item.audio_url}
                      className={[
                        "grid h-8 w-8 place-items-center rounded-full border border-white/10 transition",
                        item.audio_url
                          ? "bg-white/5 text-white hover:bg-white/10"
                          : "cursor-not-allowed bg-white/5/30 text-white/30",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-label={`Play ${item.track_title ?? "Untitled"}`}
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <span className="text-base font-semibold text-orange-400">
                      {item.rank_position}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                        {item.cover_url ? (
                          <img
                            src={item.cover_url}
                            alt={item.track_title ?? "cover"}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.4em] text-white/50">
                            No Art
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {item.track_title ?? "Untitled"}
                        </p>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">
                          {item.artist_name ?? "Unknown Artist"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-white/60">
                    {item.score_public?.toFixed(1) ?? "--"} pts
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 rounded-full bg-orange-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">
              Tekkin Quality
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {safeQuality.map((item) => (
              <div
                key={`quality-${item.version_id ?? item.rank_position}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/80 ring-1 ring-white/10"
              >
                <span className="text-lg font-semibold text-orange-400">
                  {item.rank_position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">
                    {item.track_title ?? "Untitled"}
                  </p>
                  <p className="truncate text-xs text-white/60">
                    {item.artist_name ?? "Unknown Artist"}
                  </p>
                </div>
                <span className="text-xs text-white/60">
                  {item.score_public?.toFixed(1) ?? "--"} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
