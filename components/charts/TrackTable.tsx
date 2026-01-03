"use client";

import Image from "next/image";
import { Pause, Play, Link2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SoftButton from "@/components/ui/SoftButton";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import type { ChartSnapshotEntry } from "./types";
import { mapChartsRowToTrackSnapshot } from "@/lib/tracks/trackSnapshot";

type TrackTableProps = {
  title: string;
  subtitle?: string;
  entries: ChartSnapshotEntry[];
  actionLabel?: string;
  actionHref?: string;
  dense?: boolean;
};

function numLabel(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? String(v) : "--";
}

function Cover({ coverUrl, alt, size }: { coverUrl?: string | null; alt: string; size: number }) {
  if (coverUrl) {
    return (
      <Image
        src={coverUrl}
        alt={alt}
        fill
        sizes={`${size}px`}
        className="object-cover"
      />
    );
  }
  return <div className="h-full w-full bg-gradient-to-br from-white/10 via-white/5 to-transparent" />;
}

export default function TrackTable({
  title,
  subtitle,
  entries,
  actionLabel,
  actionHref,
  dense = false,
}: TrackTableProps) {
  const router = useRouter();
  const player = useTekkinPlayer();
  const currentVersionId = useTekkinPlayer((state) => state.versionId);
  const isPlaying = useTekkinPlayer((state) => state.isPlaying);

  const [copiedTrack, setCopiedTrack] = useState<string | null>(null);

  const rows = useMemo(() => entries ?? [], [entries]);

  const handleAction = () => {
    if (actionHref) router.push(actionHref);
  };

  const launchPayload = useCallback((entry: ChartSnapshotEntry) => {
    const snapshot = mapChartsRowToTrackSnapshot(entry);
    if (!snapshot.audioUrl || !snapshot.versionId) return null;
    return {
      projectId: snapshot.projectId || entry.project_id,
      versionId: snapshot.versionId,
      title: snapshot.title ?? entry.track_title ?? "Untitled",
      subtitle: entry.artist_name ?? "Tekkin",
      collabBadges: entry.collab_badges ?? entry.collabBadges ?? null,
      audioUrl: snapshot.audioUrl,
    };
  }, []);

  const handleToggle = useCallback(
    (entry: ChartSnapshotEntry) => {
      const payload = launchPayload(entry);
      if (!payload) return;

      const isSameTrack = currentVersionId === entry.version_id;
      if (isSameTrack) {
        if (isPlaying) player.pause();
        else player.play();
        return;
      }

      player.open(payload);
    },
    [currentVersionId, isPlaying, launchPayload, player]
  );

  const handleShare = useCallback(async (entry: ChartSnapshotEntry) => {
    if (!entry.version_id) return;
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    const shareUrl = `${window.location.origin}/charts?track=${entry.version_id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedTrack(entry.version_id);
      window.setTimeout(() => setCopiedTrack(null), 1600);
    } catch {
      setCopiedTrack(null);
    }
  }, []);

  if (rows.length === 0) {
    return (
      <section className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">{title}</div>
            {subtitle && <div className="mt-1 text-sm text-white/45">{subtitle}</div>}
          </div>
          {actionLabel && (
            <SoftButton variant="accent" onClick={handleAction}>
              {actionLabel}
            </SoftButton>
          )}
        </div>
        <div className="mt-5 text-sm text-white/45">Non ci sono tracce disponibili.</div>
      </section>
    );
  }

  const padY = dense ? "py-2.5" : "py-3.5";
  const coverSize = dense ? "h-10 w-10" : "h-12 w-12";
  const coverPx = dense ? 40 : 48;

  return (
    <section className="rounded-3xl bg-white/5 ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">{title}</div>
          {subtitle && <div className="mt-1 text-sm text-white/45">{subtitle}</div>}
        </div>
        {actionLabel && (
          <SoftButton variant="accent" onClick={handleAction}>
            {actionLabel}
          </SoftButton>
        )}
      </div>

      <div className="px-2 py-2">
        <div className="space-y-2">
          {rows.map((entry) => {
            const hasAudio = Boolean(entry.audio_url);
            const isCurrent = currentVersionId === entry.version_id;
            const isActive = isCurrent && isPlaying;

            return (
              <div
                key={entry.version_id ?? `${entry.project_id}-${entry.rank_position}`}
                role="button"
                tabIndex={hasAudio ? 0 : -1}
                className={[
                  "flex items-center gap-3 rounded-2xl px-3",
                  padY,
                  "bg-black/15 ring-1 ring-white/10",
                  "transition",
                  hasAudio ? "hover:bg-black/25 hover:ring-white/15" : "opacity-60 cursor-not-allowed",
                  isActive ? "bg-black/35 ring-white/20" : "",
                ].join(" ")}
                onClick={() => hasAudio && handleToggle(entry)}
                onKeyDown={(event) => {
                  if (!hasAudio) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleToggle(entry);
                  }
                }}
              >
                <div className="w-7 text-xs font-semibold text-white/55">{entry.rank_position}</div>

                <div className={["shrink-0 overflow-hidden rounded-xl bg-white/5 relative", coverSize].join(" ")}>
                  <Cover coverUrl={entry.cover_url} alt={entry.track_title ?? "Tekkin track"} size={coverPx} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white/80">
                    {entry.track_title ?? "Untitled"}
                  </div>
                  <div className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    {entry.artist_name ?? "Unknown Artist"}
                  </div>
                </div>

                <div className="hidden w-16 text-right text-xs font-semibold uppercase tracking-[0.3em] text-white/45 sm:block">
                  {numLabel(entry.score_public)}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10 hover:bg-white/8"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!hasAudio) return;
                      handleToggle(entry);
                    }}
                    aria-label={isActive ? "Pause" : "Play"}
                  >
                    {isActive ? <Pause className="h-4 w-4 text-white/80" /> : <Play className="h-4 w-4 text-white/80" />}
                  </button>

                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10 hover:bg-white/8"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleShare(entry);
                    }}
                    aria-label="Share"
                    title={copiedTrack === entry.version_id ? "Copiato" : "Copia link"}
                  >
                    <Link2 className="h-4 w-4 text-white/70" />
                  </button>

                  {copiedTrack === entry.version_id && (
                    <span className="hidden text-xs font-semibold text-white/60 md:inline">Copiato</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
