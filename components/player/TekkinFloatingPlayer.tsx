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
  const volume = useTekkinPlayer((s) => s.volume);
  const isMuted = useTekkinPlayer((s) => s.isMuted);

  const setAudioRef = useTekkinPlayer((s) => s.setAudioRef);

  const setDuration = useTekkinPlayer((s) => s.setDuration);
  const setCurrentTime = useTekkinPlayer((s) => s.setCurrentTime);

  const play = useTekkinPlayer((s) => s.play);
  const pause = useTekkinPlayer((s) => s.pause);
  const close = useTekkinPlayer((s) => s.close);
  const seekToSeconds = useTekkinPlayer((s) => s.seekToSeconds);
  const setVolume = useTekkinPlayer((s) => s.setVolume);
  const toggleMute = useTekkinPlayer((s) => s.toggleMute);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // registra il ref una volta, senza loop
  useEffect(() => {
    setAudioRef(audioRef);

    const st = useTekkinPlayer.getState();
    const a = audioRef.current;
    if (a) {
      a.volume = st.volume;
      a.muted = st.isMuted;
    }
  }, [setAudioRef]);

  // eventi audio -> store (durata, currentTime, stato play/pause, seek pending)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTime = () => {
      const t = Number.isFinite(a.currentTime) ? a.currentTime : 0;
      setCurrentTime(t);
    };

    const pushDuration = () => {
      const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 0;
      if (d > 0) setDuration(d);
    };

    const onLoaded = () => {
      pushDuration();
      useTekkinPlayer.getState().applyPendingSeekIfPossible();
    };

    const onCanPlay = () => {
      useTekkinPlayer.getState().applyPendingSeekIfPossible();
    };

    const onDuration = () => pushDuration();

    const onPlay = () => {
      // stato reale
      useTekkinPlayer.setState({ isPlaying: true });
    };

    const onPause = () => {
      useTekkinPlayer.setState({ isPlaying: false });
    };

    const onEnded = () => {
      useTekkinPlayer.setState({ isPlaying: false });
      setCurrentTime(Number.isFinite(a.duration) ? a.duration : 0);
    };

    const onError = () => {
      const err = a.error;
      console.error("[player] audio error:", err);
      useTekkinPlayer.setState({ isPlaying: false });
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("canplay", onCanPlay);
    a.addEventListener("durationchange", onDuration);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("canplay", onCanPlay);
      a.removeEventListener("durationchange", onDuration);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
  }, [setCurrentTime, setDuration]);

  // sync volume/mute sempre
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.muted = isMuted;
  }, [volume, isMuted]);

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

    a.volume = volume;
    a.muted = isMuted;

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
        useTekkinPlayer.getState().applyPendingSeekIfPossible();
      } catch (err) {
        console.error("[player] play() failed:", err);
        useTekkinPlayer.setState({ isPlaying: false });
      }
    };

    void run();
  }, [playRequestId, audioUrl, isOpen, volume, isMuted, setCurrentTime, setDuration]);

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
              onClick={() => (isPlaying ? pause() : play())}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
            </button>

            <div className="min-w-0 flex-1">
              {(() => {
                const d = Number.isFinite(duration) && duration > 0 ? duration : 0;
                const tRaw = Number.isFinite(currentTime) && currentTime >= 0 ? currentTime : 0;
                const t = Math.min(tRaw, d || tRaw);
                const maxMs = Math.max(1, Math.floor(d * 1000));
                const valMs = Math.max(0, Math.min(maxMs, Math.floor(t * 1000)));
                return (
                  <>
                    <input
                      type="range"
                      min={0}
                      max={maxMs}
                      value={valMs}
                      onChange={(e) => seekToSeconds(Number(e.target.value) / 1000)}
                      className="w-full"
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-white/50">
                      <span>{fmt(t)}</span>
                      <span>{fmt(d)}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24"
              />
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
              >
                {isMuted ? "Muted" : "Sound"}
              </button>
            </div>

            <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" playsInline />
          </div>
        </div>
      </div>
    </div>
  );
}
