"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Volume2, VolumeX, Repeat, Heart, Share2, MoreHorizontal, MessageCircle, Repeat1 } from "lucide-react";

// Tipi
type CommentMarker = {
  id: string;
  author: string;
  text: string;
  atSeconds: number; // posizione commento in secondi
  avatarUrl?: string;
};

// Props del player
interface PlayerProps {
  audioUrl: string;
  artworkUrl?: string;
  title: string;
  artist: string;
  genre?: string;
  initialComments?: CommentMarker[];
  initialPlays?: number;
  initialLikes?: number;
  // opzionali UI flags
  allowRateChange?: boolean;
  allowLoop?: boolean;
}

export default function SoundCloudLikePlayer({
  audioUrl,
  artworkUrl = "/artwork-placeholder.jpg",
  title,
  artist,
  genre = "Minimal / Deep Tech",
  initialComments = [],
  initialPlays = 0,
  initialLikes = 0,
  allowRateChange = true,
  allowLoop = true,
}: PlayerProps) {

  // State
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(1);
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [plays, setPlays] = useState(initialPlays);
  const [comments, setComments] = useState<CommentMarker[]>(initialComments);
  const [commentDraft, setCommentDraft] = useState("");
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  // Init WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 96,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      cursorWidth: 0,
      waveColor: "#7f7f7f",
      progressColor: "#ff5500",
      url: audioUrl,
      normalize: true,
      minPxPerSec: 50,
      dragToSeek: true,
      autoScroll: true,
      autoCenter: true,
    });

    wsRef.current = ws;

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      setReady(true);
    });

    ws.on("audioprocess", () => {
      const t = ws.getCurrentTime();
      setCurrent(t);
    });

    ws.on("seek", () => {
      const t = ws.getCurrentTime();
      setCurrent(t);
    });

    ws.on("finish", () => {
      setPlaying(false);
      if (loop) {
        ws.play(0);
        setPlaying(true);
      }
    });

    // volume iniziale
    ws.setVolume(volume);

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [audioUrl, loop, volume]);

  // Play/Pause
  const togglePlay = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || !ready) return;
    if (!playing) {
      ws.play();
      setPlaying(true);
      // conteggio play alla prima pressione
      if (current === 0) setPlays(p => p + 1);
    } else {
      ws.pause();
      setPlaying(false);
    }
  }, [playing, ready, current]);

  // Stop
  const stop = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.stop();
    setPlaying(false);
    setCurrent(0);
  }, []);

  // Seek via click sulla barra superiore tempo
  const handleSeekPercent = useCallback((pct: number) => {
    const ws = wsRef.current;
    if (!ws || !ready) return;
    const t = pct * duration;
    ws.setTime(t);
    setCurrent(t);
  }, [ready, duration]);

  // Volume
  const toggleMute = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    if (muted) {
      ws.setVolume(volume);
      setMuted(false);
    } else {
      ws.setVolume(0);
      setMuted(true);
    }
  }, [muted, volume]);

  const handleVolume = useCallback((v: number) => {
    const ws = wsRef.current;
    if (!ws) return;
    const clamped = Math.min(1, Math.max(0, v));
    ws.setVolume(clamped);
    setVolume(clamped);
    setMuted(clamped === 0);
  }, []);

  // Rate
  const handleRate = useCallback((r: number) => {
    const ws = wsRef.current;
    if (!ws) return;
    setRate(r);
    ws.setPlaybackRate(r);
  }, []);

  // Keyboard: space play/pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  // Like
  const toggleLike = () => {
    if (liked) {
      setLiked(false);
      setLikes(v => Math.max(0, v - 1));
    } else {
      setLiked(true);
      setLikes(v => v + 1);
    }
  };

  // Helper format tempo
  const fmt = useCallback((t: number) => {
    if (!isFinite(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  // Comment submit alla posizione corrente
  const submitComment = () => {
    if (!commentDraft.trim()) return;
    const at = current;
    const c: CommentMarker = {
      id: `${Date.now()}`,
      author: "You",
      text: commentDraft.trim(),
      atSeconds: at,
    };
    setComments(prev => [...prev, c]);
    setCommentDraft("");
  };

  // Percentuale corrente
  const currentPct = useMemo(() => duration > 0 ? current / duration : 0, [current, duration]);

  // Hover tracking su container waveform per ghost marker
  const onWaveHover = (ev: React.MouseEvent) => {
    const div = containerRef.current;
    if (!div || duration === 0) return;
    const rect = div.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
    setHoverPct(pct);
  };
  const clearHover = () => setHoverPct(null);

  return (
    <div className="w-full bg-[#111] text-white border border-[#2a2a2a] rounded-xl overflow-hidden">
      {/* Header: artwork + info + big play */}
      <div className="flex gap-4 p-4">
        <div className="w-[120px] h-[120px] bg-[#1a1a1a] rounded-md overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artworkUrl} alt={title} className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <button
              onClick={togglePlay}
              className="h-10 px-4 rounded-md bg-[#ff5500] text-black font-semibold hover:brightness-110 active:scale-[0.98] transition"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <div className="flex flex-col">
              <div className="text-sm text-zinc-300">{artist} • {genre}</div>
              <div className="text-lg font-semibold">{title}</div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-6 text-sm text-zinc-400">
            <div className="flex items-center gap-2">
              <Heart size={16} className={liked ? "text-[#ff5500]" : ""} />
              <span>{likes.toLocaleString()}</span>
              <button onClick={toggleLike} className="underline decoration-dotted ml-2">
                {liked ? "Unlike" : "Like"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle size={16} />
              <span>{comments.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Share2 size={16} />
              <span>Share</span>
            </div>
            <div className="flex items-center gap-2">
              <MoreHorizontal size={16} />
              <span>More</span>
            </div>
            <div className="ml-auto text-xs">{plays.toLocaleString()} plays</div>
          </div>
        </div>
      </div>

      {/* Timeline bar sopra waveform: tempo, seek e progress sottile */}
      <div className="px-4">
        <div
          className="relative h-6 cursor-pointer select-none"
          onMouseMove={e => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            // solo preview, non cerca
          }}
          onClick={e => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            handleSeekPercent(pct);
          }}
        >
          <div className="absolute inset-0 bg-[#222]" />
          <div className="absolute inset-y-0 left-0 bg-[#ff5500]" style={{ width: `${currentPct * 100}%` }} />
          <div className="absolute inset-0 flex items-center justify-between px-2 text-[11px] text-zinc-400">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>

      {/* Waveform con markers commenti e hover ghost */}
      <div className="px-4 py-3">
        <div
          className="relative w-full select-none"
          onMouseMove={onWaveHover}
          onMouseLeave={clearHover}
        >
          {/* Container reale di WaveSurfer */}
          <div ref={containerRef} className="w-full" />

          {/* Marker commenti */}
          {duration > 0 && comments.map(c => {
            const pct = Math.min(1, Math.max(0, c.atSeconds / duration));
            return (
              <div
                key={c.id}
                className="absolute top-1 -translate-x-1/2"
                style={{ left: `${pct * 100}%` }}
                title={`${c.author}: ${c.text}`}
              >
                <div className="w-2 h-2 rounded-full bg-[#ff5500] shadow-[0_0_0_2px_rgba(0,0,0,0.6)]" />
              </div>
            );
          })}

          {/* Ghost marker su hover */}
          {hoverPct !== null && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-[1px] bg-white/30"
              style={{ left: `${hoverPct * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* Controls sotto waveform: Play/Pause, Stop, Volume, Loop, Rate */}
      <div className="px-4 pb-4 flex items-center gap-4 text-sm">
        <button
          onClick={togglePlay}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#ff5500] text-black font-medium hover:brightness-110"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={stop}
          className="px-3 py-1.5 rounded-md bg-[#222] hover:bg-[#2a2a2a]"
        >
          Stop
        </button>

        {/* Volume */}
        <div className="ml-2 flex items-center gap-2">
          <button onClick={toggleMute} className="p-1 rounded hover:bg-[#222]">
            {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={e => handleVolume(parseFloat(e.target.value))}
            className="w-32 accent-[#ff5500]"
          />
        </div>

        {/* Loop */}
        {allowLoop && (
          <button
            onClick={() => setLoop(v => !v)}
            className={`ml-2 p-1.5 rounded ${loop ? "bg-[#ff5500] text-black" : "bg-[#222] hover:bg-[#2a2a2a]"}`}
            title="Loop"
          >
            {loop ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        )}

        {/* Rate */}
        {allowRateChange && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-zinc-400">Speed</span>
            <select
              value={rate}
              onChange={e => handleRate(parseFloat(e.target.value))}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1"
            >
              <option value={0.75}>0.75x</option>
              <option value={0.9}>0.9x</option>
              <option value={1}>1.0x</option>
              <option value={1.1}>1.1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
        )}
      </div>

      {/* Comment composer */}
      <div className="px-4 pb-4 border-t border-[#1f1f1f]">
        <div className="flex items-center gap-2 pt-3">
          <div className="w-8 h-8 rounded-full bg-[#2a2a2a]" />
          <input
            value={commentDraft}
            onChange={e => setCommentDraft(e.target.value)}
            placeholder="Scrivi un commento"
            className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 outline-none focus:border-[#ff5500]"
            onKeyDown={e => {
              if (e.key === "Enter") submitComment();
            }}
          />
          <button
            onClick={submitComment}
            className="px-3 py-2 rounded-md bg-[#ff5500] text-black font-medium hover:brightness-110"
          >
            Commenta
          </button>
        </div>

        {/* Lista commenti basic */}
        {comments.length > 0 && (
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
            {comments
              .sort((a, b) => a.atSeconds - b.atSeconds)
              .map(c => (
                <div key={c.id} className="flex items-start gap-2 text-sm">
                  <div className="w-7 h-7 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : null}
                  </div>
                  <div className="flex-1">
                    <div className="text-zinc-300">
                      <span className="font-medium">{c.author}</span>
                      <span className="text-zinc-500 ml-2">{fmt(c.atSeconds)}</span>
                    </div>
                    <div className="text-zinc-200">{c.text}</div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
