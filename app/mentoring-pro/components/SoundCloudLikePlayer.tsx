"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Repeat, Repeat1, Download, PlusCircle, Trash2, Upload, Target
} from "lucide-react";

type CommentItem = {
  id: string;
  author: string;
  text: string;
  atSeconds: number;
};

type TrackItem = {
  id: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  src: string;        // object URL per download
  filename?: string;
  file?: File;        // il File vero per WaveSurfer
  comments?: CommentItem[];
};

function fmt(t: number) {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SoundCloudPlaylistPlayer() {
  const [playlist, setPlaylist] = useState<TrackItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  const waveRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(1);

  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const currentTrack = currentIndex >= 0 ? playlist[currentIndex] : null;
  const comments = currentTrack?.comments || [];

  // carica commenti da localStorage
  useEffect(() => {
    if (!currentTrack) return;
    const key = `tekkin_comments_${currentTrack.filename || currentTrack.title}`;
    const saved = typeof window !== "undefined"
      ? window.localStorage.getItem(key)
      : null;

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CommentItem[];
        setPlaylist(prev => {
          const copy = [...prev];
          if (!copy[currentIndex]) return prev;
          copy[currentIndex] = { ...copy[currentIndex], comments: parsed };
          return copy;
        });
      } catch {
        // ignore
      }
    }

    setSelectedTime(null);
  }, [currentIndex, currentTrack?.filename, currentTrack?.title]);

  const saveComments = (list: CommentItem[]) => {
    if (!currentTrack) return;
    if (typeof window === "undefined") return;
    const key = `tekkin_comments_${currentTrack.filename || currentTrack.title}`;
    window.localStorage.setItem(key, JSON.stringify(list));
  };

  // setup WaveSurfer SENZA url (carichiamo il File a parte)
  useEffect(() => {
    if (!waveRef.current) return;
    if (!currentTrack || !currentTrack.file) return;

    const ws = WaveSurfer.create({
      container: waveRef.current,
      height: 120,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      waveColor: "#1f2a2a",
      progressColor: "#43FFD2",
      cursorColor: "transparent",
      normalize: true,
      minPxPerSec: 70,
      dragToSeek: true,
      autoCenter: true,
    });

    wsRef.current = ws;
    setReady(false);
    setPlaying(false);
    setCurrent(0);

    const handleReady = () => {
      setDuration(ws.getDuration());
      ws.setVolume(volume);
      ws.setPlaybackRate(rate);
      setCurrent(0);
      setPlaying(false);
      setReady(true);
    };

    const handleTimeUpdate = () => {
      setCurrent(ws.getCurrentTime());
    };

    const handleFinish = () => {
      setPlaying(false);
      if (loop) {
        ws.play(0);
        setPlaying(true);
      } else {
        if (currentIndex < playlist.length - 1) {
          setCurrentIndex(i => i + 1);
        }
      }
    };

    ws.on("ready", handleReady);
    ws.on("decode", handleReady);
    ws.on("timeupdate", handleTimeUpdate);
    ws.on("seeking", handleTimeUpdate);
    ws.on("finish", handleFinish);

    // QUI: carichiamo direttamente il File, non un URL => niente fetch
    ws.load(currentTrack.file);

    return () => {
      ws.un("ready", handleReady);
      ws.un("decode", handleReady);
      ws.un("timeupdate", handleTimeUpdate);
      ws.un("seeking", handleTimeUpdate);
      ws.un("finish", handleFinish);
      ws.destroy();
      wsRef.current = null;
      setReady(false);
      setPlaying(false);
      setCurrent(0);
      setDuration(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentTrack?.file, loop]);

  // toggle play
  const togglePlay = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || !ready) return;

    if (playing) {
      ws.pause();
      setPlaying(false);
    } else {
      ws.play();
      setPlaying(true);
    }
  }, [playing, ready]);

  // scorciatoie tastiera
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }

      if (e.code === "ArrowRight") {
        e.preventDefault();
        const ws = wsRef.current;
        if (!ws) return;
        const t = Math.min(duration, ws.getCurrentTime() + 5);
        ws.setTime(t);
        setCurrent(t);
      }

      if (e.code === "ArrowLeft") {
        e.preventDefault();
        const ws = wsRef.current;
        if (!ws) return;
        const t = Math.max(0, ws.getCurrentTime() - 5);
        ws.setTime(t);
        setCurrent(t);
      }

      if (e.key.toLowerCase() === "m") {
        setSelectedTime(wsRef.current ? wsRef.current.getCurrentTime() : current);
      }

      if (e.key.toLowerCase() === "c") {
        const input = document.getElementById("comment-input") as HTMLInputElement | null;
        input?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duration, current, togglePlay]);

  const handleSeekPercent = (pct: number, setOnlyMarker = false) => {
    const ws = wsRef.current;
    if (!ws || duration === 0) return;
    const t = pct * duration;
    setSelectedTime(t);
    if (!setOnlyMarker) {
      ws.setTime(t);
      setCurrent(t);
    }
  };

  const toggleMute = () => {
    const ws = wsRef.current;
    if (!ws) return;
    if (muted) {
      ws.setVolume(volume);
      setMuted(false);
    } else {
      ws.setVolume(0);
      setMuted(true);
    }
  };

  const handleVolume = (v: number) => {
    const ws = wsRef.current;
    if (!ws) return;
    const x = Math.min(1, Math.max(0, v));
    ws.setVolume(x);
    setVolume(x);
    setMuted(x === 0);
  };

  const handleRate = (r: number) => {
    const ws = wsRef.current;
    if (!ws) return;
    setRate(r);
    ws.setPlaybackRate(r);
  };

  const currentPct = useMemo(
    () => (duration > 0 ? current / duration : 0),
    [current, duration]
  );

  // commenti
  const addComment = () => {
    if (!currentTrack) return;
    const text = commentDraft.trim();
    if (!text) return;

    const at = selectedTime !== null ? selectedTime : current;

    const c: CommentItem = {
      id: `${Date.now()}`,
      author: "You",
      text,
      atSeconds: Math.min(Math.max(0, at), duration || at),
    };

    const updated = [...comments, c].sort((a, b) => a.atSeconds - b.atSeconds);

    setPlaylist(prev => {
      const copy = [...prev];
      if (!copy[currentIndex]) return prev;
      copy[currentIndex] = { ...copy[currentIndex], comments: updated };
      return copy;
    });

    saveComments(updated);
    setCommentDraft("");
  };

  const removeComment = (id: string) => {
    if (!currentTrack) return;
    const updated = comments.filter(c => c.id !== id);

    setPlaylist(prev => {
      const copy = [...prev];
      if (!copy[currentIndex]) return prev;
      copy[currentIndex] = { ...copy[currentIndex], comments: updated };
      return copy;
    });

    saveComments(updated);
  };

  // upload: salviamo sia File che objectURL
  const onUpload = (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const url = URL.createObjectURL(f);
    const baseTitle = f.name.replace(/\.[^/.]+$/, "");

    const newTrack: TrackItem = {
      id: `${Date.now()}`,
      title: baseTitle,
      artist: "Uploaded",
      src: url,
      filename: f.name,
      artworkUrl: "/images/your-art.jpg",
      file: f,
      comments: [],
    };

    setPlaylist(prev => [newTrack, ...prev]);
    setCurrentIndex(0);
  };

  const next = () => {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(i => i + 1);
    }
  };

  const prev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    }
  };

  const clickToPercent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  };

  // ╔════════════════════════════════════╗
  // ║              RENDER                ║
  // ╚════════════════════════════════════╝
  return (
    <div className="w-full rounded-2xl border border-[#0d2c2c] bg-[#070b0b] text-zinc-100 overflow-hidden shadow-[0_0_30px_rgba(67,255,210,0.08)] relative">
      {/* HUD angoli */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-[#43FFD2] opacity-60" />
        <div className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-[#43FFD2] opacity-60" />
        <div className="absolute left-0 bottom-0 h-8 w-8 border-b-2 border-l-2 border-[#43FFD2] opacity-60" />
        <div className="absolute right-0 bottom-0 h-8 w-8 border-b-2 border-r-2 border-[#43FFD2] opacity-60" />
      </div>

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 p-4">
        <label className="inline-flex items-center gap-2 rounded-md border border-[#123636] bg-[#0c1414] px-3 py-2 hover:bg-[#0e1818] cursor-pointer">
          <Upload size={16} />
          <span>Carica traccia</span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={e => onUpload(e.target.files)}
          />
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={prev}
            className="rounded-md bg-[#0c1414] p-2 hover:bg-[#0e1818] border border-[#123636]"
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={togglePlay}
            className="flex items-center gap-2 rounded-md bg-[#43FFD2] px-4 py-2 text-black font-medium hover:brightness-110 active:scale-[0.98]"
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
            {playing ? "Pause" : "Play"}
          </button>

          <button
            onClick={next}
            className="rounded-md bg-[#0c1414] p-2 hover:bg-[#0e1818] border border-[#123636]"
          >
            <SkipForward size={16} />
          </button>

          <button
            onClick={() => setLoop(v => !v)}
            className={`ml-2 rounded-md p-2 border ${
              loop
                ? "bg-[#43FFD2] text-black border-[#43FFD2]"
                : "bg-[#0c1414] hover:bg-[#0e1818] border-[#123636]"
            }`}
            title="Loop"
          >
            {loop ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>
      </div>

      {/* Now playing */}
      <div className="flex items-center gap-4 px-4">
        <div className="h-16 w-16 overflow-hidden rounded-md bg-[#0e1616] ring-1 ring-[#123636]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentTrack?.artworkUrl || "/images/your-art.jpg"}
            alt={currentTrack?.title || "artwork"}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0">
          <div className="text-[13px] text-[#74ffe7] truncate tracking-wide">
            {currentTrack?.artist || "-"} • Minimal
          </div>
          <div className="truncate text-lg font-semibold">
            {currentTrack?.title || "Nessuna traccia"}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="rounded p-1.5 hover:bg-[#0c1414] border border-[#123636]"
            >
              {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={e => handleVolume(parseFloat(e.target.value))}
              className="w-32 accent-[#43FFD2]"
              aria-label="Volume"
            />
          </div>

          {/* Rate */}
          <select
            value={rate}
            onChange={e => handleRate(parseFloat(e.target.value))}
            className="rounded border border-[#123636] bg-[#0c1414] px-2 py-1 text-sm"
            aria-label="Playback speed"
          >
            <option value={0.75}>0.75x</option>
            <option value={0.9}>0.90x</option>
            <option value={1}>1.00x</option>
            <option value={1.1}>1.10x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.50x</option>
          </select>

          {currentTrack && (
            <a
              href={currentTrack.src}
              download={currentTrack.filename || `${currentTrack.title || "track"}.wav`}
              className="inline-flex items-center gap-2 rounded-md border border-[#123636] bg-[#0c1414] px-3 py-2 hover:bg-[#0e1818]"
            >
              <Download size={16} />
              Download
            </a>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 pt-3">
        <div
          className="relative h-6 cursor-pointer select-none group"
          onClick={e => {
            const pct = clickToPercent(e);
            handleSeekPercent(pct, false);
          }}
          onContextMenu={e => {
            e.preventDefault();
            const pct = clickToPercent(e);
            handleSeekPercent(pct, true);
          }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={current}
        >
          <div className="absolute inset-0 rounded bg-[#0e1616]" />
          <div
            className="absolute inset-y-0 left-0 rounded bg-[#43FFD2]"
            style={{ width: `${currentPct * 100}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded mix-blend-screen pointer-events-none"
            style={{
              width: `${currentPct * 100}%`,
              background:
                "linear-gradient(90deg, rgba(255,0,85,0.25), rgba(0,255,255,0.25))",
              transform: "translate3d(1px, 0, 0)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 animate-[tekkinJitter_0.5s_infinite_steps(2)]" />
          <div className="absolute inset-0 flex items-center justify-between px-2 text-[11px] text-[#9adfd0]">
            <span>{fmt(selectedTime ?? current)}</span>
            <span>{fmt(duration)}</span>
          </div>
          <div className="absolute inset-0 rounded ring-0 group-hover:ring-1 ring-[#43FFD2]/50 transition" />
        </div>
      </div>

      {/* Waveform */}
      <div
        className="relative px-4 py-3"
        onClick={e => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          handleSeekPercent(pct, false);
        }}
        onContextMenu={e => {
          e.preventDefault();
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          handleSeekPercent(pct, true);
        }}
      >
        <div ref={waveRef} className="w-full relative z-[2]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background:repeating-linear-gradient(0deg,transparent,transparent_2px,#000_3px)] z-[1]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:3px_3px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(transparent_65%,rgba(12,24,24,0.55))]" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-0 right-0 h-3 top-1/3 bg-[#43FFD2]/10 animate-[tekkinSlice_2.2s_linear_infinite]" />
          <div className="absolute left-0 right-0 h-[2px] top-[62%] bg-[#43FFD2]/15 animate-[tekkinSlice_3s_linear_infinite]" />
        </div>

        {/* Marker selezionato */}
        {selectedTime !== null && duration > 0 && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[3]"
            style={{ left: `${(selectedTime / duration) * 100}%` }}
          >
            <div className="-translate-x-1/2 flex items-center gap-1">
              <div className="h-full w-[2px] bg-[#43FFD2]" />
              <div className="-translate-y-2 rounded bg-[#0c1414] px-2 py-1 text-[10px] border border-[#123636] text-[#74ffe7] flex items-center gap-1">
                <Target size={12} /> {fmt(selectedTime)}
              </div>
            </div>
          </div>
        )}

        {/* Marker commenti */}
        {duration > 0 &&
          comments.map(c => {
            const pct = Math.min(1, Math.max(0, c.atSeconds / duration));
            return (
              <button
                key={c.id}
                title={c.text}
                className="absolute top-2 -translate-x-1/2 z-[3]"
                style={{ left: `${pct * 100}%` }}
                onClick={e => {
                  e.stopPropagation();
                  handleSeekPercent(c.atSeconds / duration, false);
                }}
              >
                <div className="h-3 w-[2px] bg-[#74ffe7] shadow-[0_0_8px_rgba(67,255,210,0.6)]" />
              </button>
            );
          })}
      </div>

      {/* Commenti */}
      <div className="border-t border-[#123636] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-[#0c1414] h-8 w-8 border border-[#123636]" />
          <input
            id="comment-input"
            value={commentDraft}
            onChange={e => setCommentDraft(e.target.value)}
            placeholder={`Commenta a ${fmt(selectedTime ?? current)}`}
            className="flex-1 rounded border border-[#123636] bg-[#0c1414] px-3 py-2 outline-none focus:border-[#43FFD2]"
            onKeyDown={e => {
              if (e.key === "Enter") addComment();
            }}
          />
          <button
            onClick={addComment}
            className="inline-flex items-center gap-2 rounded-md bg-[#43FFD2] px-3 py-2 text-black hover:brightness-110"
          >
            <PlusCircle size={16} />
            Commenta
          </button>
        </div>

        {comments.length > 0 && (
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
            {comments.map(c => (
              <div key={c.id} className="flex items-start gap-2 text-sm">
                <div className="rounded-full bg-[#0c1414] h-7 w-7 border border-[#123636]" />
                <div className="flex-1">
                  <div className="text-[#9adfd0]">
                    <span className="font-medium text-zinc-200">You</span>
                    <button
                      className="ml-2 rounded bg-[#0c1414] px-2 py-[2px] text-[11px] text-[#74ffe7] border border-[#123636] hover:bg-[#0e1818]"
                      onClick={() =>
                        handleSeekPercent(c.atSeconds / (duration || 1), false)
                      }
                      title="Vai al punto"
                    >
                      {fmt(c.atSeconds)}
                    </button>
                  </div>
                  <div className="text-zinc-100">{c.text}</div>
                </div>
                <button
                  className="rounded p-1 text-zinc-400 hover:text-zinc-200"
                  onClick={() => removeComment(c.id)}
                  title="Elimina"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Playlist */}
      <div className="border-t border-[#123636] bg-[#070c0c]">
        <div className="px-4 py-2 text-xs uppercase tracking-wider text-[#74ffe7]">
          Playlist
        </div>

        {playlist.length === 0 && (
          <div className="px-4 pb-4 text-sm text-zinc-400">
            Carica una traccia per iniziare.
          </div>
        )}

        {playlist.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setCurrentIndex(i)}
            className={`flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-[#0c1414] border-t border-[#0e1f1f] ${
              i === currentIndex ? "bg-[#0a1212]" : ""
            }`}
          >
            <div className="h-10 w-10 rounded bg-[#0e1616] overflow-hidden ring-1 ring-[#123636]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.artworkUrl || "/images/your-art.jpg"}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm text-zinc-100">{t.title}</div>
              <div className="truncate text-[12px] text-[#74ffe7]">
                {t.artist || "-"}
              </div>
            </div>
            {i === currentIndex && (
              <div className="ml-auto text-[12px] text-[#9adfd0]">
                {comments.length} comments
              </div>
            )}
          </button>
        ))}
      </div>

      {/* keyframes glitch */}
      <style jsx global>{`
        @keyframes tekkinJitter {
          0% { transform: translate3d(0,0,0); }
          50% { transform: translate3d(0.3px,0,0); }
          100% { transform: translate3d(0,0,0); }
        }
        @keyframes tekkinSlice {
          0% { transform: translateY(-10px); opacity: 0; }
          10% { opacity: 0.3; }
          50% { transform: translateY(0); opacity: 0.15; }
          90% { opacity: 0.3; }
          100% { transform: translateY(10px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
