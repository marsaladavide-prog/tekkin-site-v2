"use client";

import { useEffect, useRef } from "react";
import { Pause, Play, X } from "lucide-react";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";

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
  const audioUrl = useTekkinPlayer((s) => s.audioUrl);
  const duration = useTekkinPlayer((s) => s.duration);
  const currentTime = useTekkinPlayer((s) => s.currentTime);
  const playRequestId = useTekkinPlayer((s) => s.playRequestId);
  const pendingSeekRatio = useTekkinPlayer((s) => s.pendingSeekRatio);

  const setAudioRef = useTekkinPlayer((s) => s.setAudioRef);
  const setDuration = useTekkinPlayer((s) => s.setDuration);
  const setCurrentTime = useTekkinPlayer((s) => s.setCurrentTime);
  const clearPendingSeek = useTekkinPlayer((s) => s.clearPendingSeek);

  const play = useTekkinPlayer((s) => s.play);
  const pause = useTekkinPlayer((s) => s.pause);
  const close = useTekkinPlayer((s) => s.close);
  const seekToSeconds = useTekkinPlayer((s) => s.seekToSeconds);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // registra il ref una volta, senza loop
  useEffect(() => {
    setAudioRef(audioRef as unknown as React.RefObject<HTMLAudioElement>);
    return () => setAudioRef(null);
  }, [setAudioRef]);

  // eventi audio -> store
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTime = () => setCurrentTime(a.currentTime || 0);
    const onLoaded = () => {
      setDuration(a.duration || 0);

      // se c'è un seek pending (click sulla waveform su traccia nuova)
      if (pendingSeekRatio != null && Number.isFinite(a.duration) && a.duration > 0) {
        a.currentTime = pendingSeekRatio * a.duration;
        setCurrentTime(a.currentTime || 0);
        clearPendingSeek();
      }
    };
    const onDuration = () => setDuration(a.duration || 0);
    const onEnded = () => {
      pause();
      setCurrentTime(a.duration || 0);
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("durationchange", onDuration);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("durationchange", onDuration);
      a.removeEventListener("ended", onEnded);
    };
  }, [setCurrentTime, setDuration, pendingSeekRatio, clearPendingSeek, pause]);

  // autoplay affidabile: quando cambia playRequestId, prova a playare davvero
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!audioUrl || !isOpen) return;

    if (!isPlaying) {
      a.pause();
      return;
    }

    const run = async () => {
      try {
        // forziamo reload sul nuovo src
        a.load();
        await a.play();
      } catch {
        // autoplay bloccato: resta pronto, l'utente clicca play
      }
    };

    void run();
  }, [playRequestId, audioUrl, isOpen, isPlaying]);

  if (!isOpen || !audioUrl) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999]">
      <div className="border-t border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{title || "Preview"}</div>
              <div className="truncate text-xs text-white/60">{subtitle}</div>
            </div>

            <button
              onClick={close}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => (isPlaying ? pause() : play())}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
            </button>

            <div className="min-w-0 flex-1">
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(duration * 1000))}
                value={Math.floor(currentTime * 1000)}
                onChange={(e) => seekToSeconds(Number(e.target.value) / 1000)}
                className="w-full"
              />
              <div className="mt-1 flex justify-between text-[11px] text-white/50">
                <span>{fmt(currentTime)}</span>
                <span>{fmt(duration)}</span>
              </div>
            </div>

            <audio ref={audioRef} src={audioUrl} preload="metadata" />
          </div>
        </div>
      </div>
    </div>
  );
}
