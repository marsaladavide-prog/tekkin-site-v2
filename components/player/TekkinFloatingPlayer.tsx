"use client";

import Link from "next/link";
import { useEffect, useRef, useCallback } from "react";
import { Pause, Play, X } from "lucide-react";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import type { TrackCollabBadge } from "@/lib/tracks/types";

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) return "00:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TekkinFloatingPlayer() {
  const isOpen = useTekkinPlayer((s) => s.isOpen);
  const isPlaying = useTekkinPlayer((s) => s.isPlaying);
  const title = useTekkinPlayer((s) => s.title);
  const subtitle = useTekkinPlayer((s) => s.subtitle);
  const collabBadges = useTekkinPlayer((s) => s.collabBadges);
  const audioUrl = useTekkinPlayer((s) => s.audioUrl);
  const duration = useTekkinPlayer((s) => s.duration);
  const currentTime = useTekkinPlayer((s) => s.currentTime);
  const playRequestId = useTekkinPlayer((s) => s.playRequestId);
  const volume = useTekkinPlayer((s) => s.volume);
  const isMuted = useTekkinPlayer((s) => s.isMuted);
  const setIsPlaying = useTekkinPlayer((s) => s.setIsPlaying);

  const setAudioRef = useTekkinPlayer((s) => s.setAudioRef);

  const setDuration = useTekkinPlayer((s) => s.setDuration);
  const setCurrentTime = useTekkinPlayer((s) => s.setCurrentTime);

  const play = useTekkinPlayer((s) => s.play);
  const pause = useTekkinPlayer((s) => s.pause);
  const close = useTekkinPlayer((s) => s.close);
  const seekToSeconds = useTekkinPlayer((s) => s.seekToSeconds);
  const setVolume = useTekkinPlayer((s) => s.setVolume);
  const toggleMute = useTekkinPlayer((s) => s.toggleMute);
  const artistSlug = useTekkinPlayer((s) => s.artistSlug);

  const renderArtistLinks = (badges: TrackCollabBadge[]) => {
    const cleaned = badges
      .map((badge) => ({ ...badge, label: badge.label.trim() }))
      .filter((badge) => badge.label.length > 0);

    if (cleaned.length === 0) return null;
    if (cleaned.length === 1) {
      const badge = cleaned[0];
      return badge.href ? (
        <Link href={badge.href} className="hover:text-white hover:underline">
          {badge.label}
        </Link>
      ) : (
        <span>{badge.label}</span>
      );
    }

    const [owner, ...others] = cleaned;
    const renderLink = (badge: TrackCollabBadge) =>
      badge.href ? (
        <Link
          key={`${badge.label}-${badge.href ?? "nolink"}`}
          href={badge.href}
          className="hover:text-white hover:underline"
        >
          {badge.label}
        </Link>
      ) : (
        <span key={badge.label}>{badge.label}</span>
      );

    if (others.length === 1) {
      return (
        <>
          {renderLink(owner)}
          {", "}
          {renderLink(others[0])}
        </>
      );
    }

    return (
      <>
        {renderLink(owner)}
        {" feat. "}
        {others.map((badge, index) => (
          <span key={`${badge.label}-${index}`}>
            {renderLink(badge)}
            {index < others.length - 1 ? " & " : ""}
          </span>
        ))}
      </>
    );
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // registra il ref una volta, senza loop
  useEffect(() => {
    setAudioRef(audioRef);

    const a = audioRef.current;
    if (a) {
      a.volume = volume;
      a.muted = isMuted;
    }
  }, [setAudioRef, volume, isMuted]);

  // eventi audio -> store (durata, currentTime, stato play/pause, seek pending)
  const handleTimeUpdate = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      const t = Number.isFinite(a.currentTime) ? a.currentTime : 0;
      setCurrentTime(t);
    }
  }, [setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 0;
      if (d > 0) setDuration(d);
      useTekkinPlayer.getState().applyPendingSeekIfPossible();
    }
  }, [setDuration]);

  const handleEnded = useCallback(() => {
    const a = audioRef.current;
    setCurrentTime(a && Number.isFinite(a.duration) ? a.duration : 0);
    setIsPlaying(false);
  }, [setCurrentTime, setIsPlaying]);

  const handleError = useCallback(() => {
    const a = audioRef.current;
    if (a && a.error) {
      console.error("[player] audio error:", a.error);
      setIsPlaying(false);
    }
  }, [setIsPlaying]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    a.addEventListener("timeupdate", handleTimeUpdate);
    a.addEventListener("loadedmetadata", handleLoadedMetadata);
    a.addEventListener("canplay", handleLoadedMetadata);
    a.addEventListener("durationchange", handleLoadedMetadata);
    a.addEventListener("ended", handleEnded);
    a.addEventListener("error", handleError);

    return () => {
      a.removeEventListener("timeupdate", handleTimeUpdate);
      a.removeEventListener("loadedmetadata", handleLoadedMetadata);
      a.removeEventListener("canplay", handleLoadedMetadata);
      a.removeEventListener("durationchange", handleLoadedMetadata);
      a.removeEventListener("ended", handleEnded);
      a.removeEventListener("error", handleError);
    };
  }, [handleTimeUpdate, handleLoadedMetadata, handleEnded, handleError]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
    };
  }, [setIsPlaying]);

  const onTogglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;

    if (a.paused) {
      // riprende usando la logica già prevista (playRequestId)
      play();
    } else {
      pause();
    }
  }, [play, pause]);

  // sync volume/mute sempre
  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.volume = volume;
      a.muted = isMuted;
    }
  }, [volume, isMuted]);

  // driver progress robusto (evita timeupdate che a volte non aggiorna)
  useEffect(() => {
    if (!isOpen || !audioUrl) return;

    let raf = 0;

    const tick = () => {
      const a = audioRef.current;
      if (a) {
        const t = Number.isFinite(a.currentTime) ? a.currentTime : 0;
        setCurrentTime(t);

        const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 0;
        if (d > 0) setDuration(d);
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [isOpen, audioUrl, setCurrentTime, setDuration]);

  // driver di playback: playRequestId è il "trigger", audioUrl è la sorgente
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    if (!isOpen || !audioUrl) {
      a.pause();
      a.removeAttribute("src");
      a.load();
      useTekkinPlayer.setState({ isPlaying: false });
      setCurrentTime(0);
      return;
    }

    const st = useTekkinPlayer.getState();

    // reload SOLO se cambia versione
    if (st.lastLoadedVersionId !== st.versionId) {
      useTekkinPlayer.setState({
        isPlaying: false,
        lastLoadedVersionId: st.versionId,
      });

      setCurrentTime(0);
      a.src = audioUrl;
      a.currentTime = 0;
      a.load();
    }

    const run = async () => {
      try {
        await a.play();
        setIsPlaying(true);
        useTekkinPlayer.getState().applyPendingSeekIfPossible();
      } catch (err) {
        console.error("[player] play() failed:", err);
        setIsPlaying(false);
      }
    };

    void run();
  }, [playRequestId, audioUrl, isOpen, setCurrentTime, setDuration, setIsPlaying]);

  if (!isOpen || !audioUrl) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999]">
      <div className="border-t border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{title || "Preview"}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                {Array.isArray(collabBadges) && collabBadges.length > 0 ? (
                  renderArtistLinks(collabBadges)
                ) : artistSlug ? (
                  <Link href={`/@${artistSlug}`} className="hover:text-white hover:underline">
                    {subtitle}
                  </Link>
                ) : (
                  <span>{subtitle}</span>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                close();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={onTogglePlay}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
            </button>

            <div className="min-w-0 flex-1">
              {(() => {
                const a = audioRef.current;

                const dStore = Number.isFinite(duration) && duration > 0 ? duration : 0;
                const dEl = a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 0;
                const d = dStore || dEl;

                const tStore = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;
                const tEl = a && Number.isFinite(a.currentTime) && a.currentTime >= 0 ? a.currentTime : 0;
                const t = Math.min(tStore || tEl, d || (tStore || tEl));
                const maxMs = Math.max(1, Math.floor(d * 1000));
                const valMs = Math.max(0, Math.min(maxMs, Math.floor(t * 1000)));
                const pct = maxMs > 0 ? (valMs / maxMs) * 100 : 0;
                return (
                  <>
                    <input
                      type="range"
                      min={0}
                      max={maxMs}
                      value={valMs}
                      onChange={(e) => seekToSeconds(Number(e.target.value) / 1000)}
                      className="w-full h-2 appearance-none rounded-full bg-white/10"
                      style={{
                        background: `linear-gradient(to right, rgba(255,255,255,0.85) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
                      }}
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-white/50">
                      <span>{fmt(t)}</span>
                      <span>{fmt(d)}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                {/* Barra principale minimal */}
                <div className="relative h-1.5 w-24 rounded-full bg-white/20 overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-200 ease-out"
                    style={{ width: `${volume * 100}%` }}
                  />
                </div>
                
                {/* Thumb minimal circolare - centrato correttamente */}
                <div 
                  className="absolute -top-1.5 h-4 w-4 bg-cyan-400 rounded-full border border-white/50 shadow-lg transition-all duration-150 hover:scale-110 cursor-pointer"
                  style={{ 
                    left: `max(0px, min(calc(${volume * 100}% - 8px), 80px))`,
                    boxShadow: '0 0 8px rgba(34, 211, 238, 0.6)'
                  }}
                />
                
                {/* Input invisibile per funzionalità */}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="absolute inset-0 w-full h-4 opacity-0 cursor-pointer"
                />
              </div>
              
              <button
                type="button"
                onClick={toggleMute}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:border-cyan-400/30 transition-all duration-200"
                title={isMuted ? "Riattiva audio" : "Disattiva audio"}
              >
                <span className="text-sm">
                  {isMuted ? "🔇" : volume === 0 ? "🔊" : "🔊"}
                </span>
              </button>
            </div>

            <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" playsInline />
          </div>
        </div>
      </div>
    </div>
  );
}
