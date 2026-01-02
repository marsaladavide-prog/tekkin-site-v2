"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";

import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import WaveformPreviewUnified from "@/components/player/WaveformPreviewUnified";
import type { PlayPayload } from "@/lib/player/useTekkinPlayer";
import type { TrackCollabBadge, TrackItem } from "@/lib/tracks/types";

type Props = {
  items: TrackItem[];
};

const formatTimeLabel = (seconds?: number | null) => {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const resolvePlayPayload = (item: TrackItem, audioUrl: string): PlayPayload => ({
  projectId: item.projectId ?? null,
  versionId: item.versionId,
  title: item.title,
  subtitle: item.artistName ?? undefined,
  collabBadges: item.collabBadges ?? null,
  artistId: item.artistId ?? null,
  artistSlug: item.artistSlug ?? null,
  audioUrl,
  duration: item.waveformDuration ?? undefined,
  coverUrl: item.coverUrl ?? null,
});

const renderCollabBadges = (badges?: TrackCollabBadge[] | null) => {
  if (!badges || badges.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-white/45">
      {badges.map((badge, index) => {
        const content = (
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
            {badge.label}
          </span>
        );
        if (badge.href) {
          return (
            <Link
              key={`${badge.label}-${index}`}
              href={badge.href}
              className="hover:text-white/80"
            >
              {content}
            </Link>
          );
        }
        return (
          <span key={`${badge.label}-${index}`} className="text-white/60">
            {content}
          </span>
        );
      })}
    </div>
  );
};

export default function PublicTracksGallery({ items }: Props) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    items[0]?.versionId ?? null
  );
  const [signedCache, setSignedCache] = useState<Record<string, string | null>>({});
  const [signingVersionId, setSigningVersionId] = useState<string | null>(null);

  useEffect(() => {
    if (!items.length) {
      setSelectedVersionId(null);
      return;
    }
    if (!selectedVersionId || !items.some((item) => item.versionId === selectedVersionId)) {
      setSelectedVersionId(items[0].versionId);
    }
  }, [items, selectedVersionId]);

  const selectedItem = useMemo(
    () =>
      (selectedVersionId ? items.find((item) => item.versionId === selectedVersionId) : null) ??
      items[0] ??
      null,
    [items, selectedVersionId]
  );

  const currentVersionId = useTekkinPlayer((state) => state.versionId);
  const playerDuration = useTekkinPlayer((state) => state.duration);
  const playerCurrentTime = useTekkinPlayer((state) => state.currentTime);
  const isPlaying = useTekkinPlayer((state) => state.isPlaying);
  const play = useTekkinPlayer((state) => state.play);
  const playAtRatio = useTekkinPlayer((state) => state.playAtRatio);

  const isActive = Boolean(selectedItem && currentVersionId === selectedItem.versionId);
  const progressRatio =
    isActive && Number.isFinite(playerDuration) && playerDuration > 0
      ? playerCurrentTime / playerDuration
      : 0;
  const durationForLabel =
    selectedItem?.waveformDuration ??
    (isActive && Number.isFinite(playerDuration) && playerDuration > 0 ? playerDuration : null);
  const timeLabel = formatTimeLabel(durationForLabel);

  const ensureAudioUrl = useCallback(
    async (item: TrackItem) => {
      if (item.audioUrl) return item.audioUrl;
      if (Object.prototype.hasOwnProperty.call(signedCache, item.versionId)) {
        return signedCache[item.versionId];
      }
      setSigningVersionId(item.versionId);
      try {
        const res = await fetch("/api/storage/sign-track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version_id: item.versionId }),
        });
        if (!res.ok) return null;
        const json = (await res.json().catch(() => null)) as { audio_url?: string } | null;
        const url = typeof json?.audio_url === "string" ? json.audio_url : null;
        setSignedCache((prev) => ({ ...prev, [item.versionId]: url }));
        return url;
      } finally {
        setSigningVersionId((current) => (current === item.versionId ? null : current));
      }
    },
    [signedCache]
  );

  const handlePlayTrack = useCallback(
    async (item: TrackItem, ratio?: number) => {
      setSelectedVersionId(item.versionId);
      const audioUrl = await ensureAudioUrl(item);
      if (!audioUrl) return;
      const payload = resolvePlayPayload(item, audioUrl);
      if (typeof ratio === "number") {
        playAtRatio(payload, ratio);
        return;
      }
      if (item.versionId === currentVersionId) {
        useTekkinPlayer.getState().toggle();
        return;
      }
      play(payload);
    },
    [ensureAudioUrl, play, playAtRatio, currentVersionId]
  );

  const handleTogglePlay = useCallback(() => {
    if (!selectedItem) return;
    void handlePlayTrack(selectedItem);
  }, [selectedItem, handlePlayTrack]);

  const handleSeekRatio = useCallback(
    (ratio: number) => {
      if (!selectedItem) return;
      void handlePlayTrack(selectedItem, ratio);
    },
    [selectedItem, handlePlayTrack]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_45px_rgba(0,0,0,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">Waveform</p>
            <h3 className="text-2xl font-semibold text-white">
              {selectedItem?.title ?? "Traccia pubblica"}
            </h3>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">
              {selectedItem?.artistName ?? "Artist"}
            </p>
            {renderCollabBadges(selectedItem?.collabBadges ?? null)}
          </div>

          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/60">
            <span className="text-xl font-bold text-white">
              {selectedItem?.scorePublic != null ? Math.round(selectedItem.scorePublic) : "--"}
            </span>
            <span className="text-[10px] text-white/40">score</span>
          </div>
        </div>

        {selectedItem ? (
          <div className="mt-4">
            <WaveformPreviewUnified
              peaks={selectedItem.waveformPeaks ?? null}
              bands={selectedItem.waveformBands ?? null}
              duration={selectedItem.waveformDuration ?? null}
              progressRatio={progressRatio}
              isPlaying={isActive && isPlaying}
              timeLabel={timeLabel}
              onTogglePlay={handleTogglePlay}
              onSeekRatio={handleSeekRatio}
            />
          </div>
        ) : (
          <div className="mt-4 flex h-20 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xs uppercase tracking-[0.4em] text-white/50">
            Nessuna traccia selezionata
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const isSelected = selectedItem?.versionId === item.versionId;
          const isSigningTrack = signingVersionId === item.versionId;
          return (
            <button
              key={item.versionId}
              type="button"
              onClick={() => void handlePlayTrack(item)}
              className={`flex flex-col gap-3 rounded-3xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-400/70 ${
                isSelected
                  ? "border-cyan-400/70 bg-white/5 shadow-[0_20px_50px_rgba(3,7,18,0.65)]"
                  : "border-white/10 bg-black/30"
              }`}
            >
              <div className="relative h-48 w-full overflow-hidden rounded-[26px] border border-white/10 bg-black/60">
                {item.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-[0.4em] text-white/50">
                    Cover mancante
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute left-3 bottom-3 flex items-center gap-2 rounded-full border border-white/30 bg-black/50 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/80">
                  <Play className="h-3 w-3" />
                  {isSigningTrack ? "Loading" : "Play"}
                </div>
                {isSelected && (
                  <div className="pointer-events-none absolute inset-1 rounded-[24px] border border-cyan-300/60" />
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
                  {item.scorePublic != null ? Math.round(item.scorePublic) : "--"}
                </span>
              </div>
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">
                {item.artistName ?? "Artist"}
              </p>
              {renderCollabBadges(item.collabBadges ?? null)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
