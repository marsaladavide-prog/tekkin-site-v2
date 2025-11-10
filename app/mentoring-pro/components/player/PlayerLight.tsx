"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Download } from "lucide-react";

export default function PlayerLight({
  audioUrl,
  title,
  artist,
  artworkUrl,
}: {
  audioUrl: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = new Audio(audioUrl);
    audioRef.current = el;
    const onTime = () => setProgress(el.currentTime);
    const onLoaded = () => setDuration(el.duration || 0);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [audioUrl]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play();
      setPlaying(true);
    }
  };

  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const v = Number(e.target.value);
    el.currentTime = v;
    setProgress(v);
  };

  return (
    <div className="flex gap-3 items-center">
      <div className="h-14 w-14 rounded-lg bg-zinc-50 border border-[#eef1f4] overflow-hidden grid place-items-center">
        {artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artworkUrl} alt="art" className="h-full w-full object-cover" />
        ) : (
          <div className="text-xs text-zinc-400">No art</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{title}</div>
        {artist ? <div className="text-xs text-zinc-500 truncate">{artist}</div> : null}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={progress}
          onChange={seek}
          className="w-full accent-cyan-600"
        />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={toggle} className="h-9 w-9 rounded-md border border-[#e8ecef] grid place-items-center hover:bg-zinc-50">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button onClick={toggleMute} className="h-9 w-9 rounded-md border border-[#e8ecef] grid place-items-center hover:bg-zinc-50">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <a
          href={audioUrl}
          download
          className="h-9 w-9 rounded-md border border-[#e8ecef] grid place-items-center hover:bg-zinc-50"
          title="Scarica"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
