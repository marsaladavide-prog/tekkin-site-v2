"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Upload, Volume2, VolumeX, Download } from "lucide-react";

type CompactPlayerProps = {
  title?: string;
};

export default function CompactPlayer(props: CompactPlayerProps) {
  const { title = "Nuova traccia" } = props || {};

  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const objectUrlRef = useRef<string | null>(null); // solo per download

  // stato
  const [sourceUrl, setSourceUrl] = useState(""); // usato SOLO per download
  const [fileName, setFileName] = useState(title);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // crea WaveSurfer UNA sola volta
  useEffect(() => {
    if (!waveformRef.current) return;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#4ade80",
      progressColor: "#22c55e",
      cursorColor: "#ffffff",
      barWidth: 2,
      barGap: 2,
      height: 80,
    });

    ws.on("ready", () => {
      setIsReady(true);
      setDuration(ws.getDuration());
      setCurrentTime(0);
      setIsPlaying(false);
      ws.setVolume(volume);
    });

    ws.on("audioprocess", () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on("finish", () => {
      setIsPlaying(false);
      setCurrentTime(ws.getDuration());
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // carica DIRETTAMENTE il file nel player (niente fetch, niente load(url))
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // URL solo per il bottone di download
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    setSourceUrl(url);
    setFileName(file.name);

    const ws = wavesurferRef.current;
    if (ws) {
      setIsReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      // @ts-ignore: WaveSurfer 7 supporta loadBlob
      ws.loadBlob(file);
    }
  }

  function handleTogglePlay() {
    const ws = wavesurferRef.current;
    if (!ws || !isReady) return;
    ws.playPause();
    setIsPlaying((prev) => !prev);
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setVolume(v);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(v);
    }
  }

  function formatTime(t: number) {
    if (!t || Number.isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  const canPlay = Boolean(sourceUrl && isReady);

  return (
    <div className="w-full max-w-4xl mx-auto bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4">
      {/* titolo + upload */}
      <div className="flex items-center gap-3">
        <input
          className="flex-1 bg-transparent border-none outline-none text-sm md:text-base font-medium text-zinc-100 px-2 py-1 rounded-md focus:ring-1 focus:ring-emerald-500/70"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
        />
        <label className="inline-flex items-center gap-2 text-xs md:text-sm px-3 py-2 rounded-lg border border-zinc-700 hover:border-emerald-500/70 cursor-pointer">
          <Upload className="w-4 h-4" />
          <span>Carica traccia</span>
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {/* waveform SEMPRE montata */}
      <div className="w-full bg-zinc-800/60 rounded-xl overflow-hidden px-2 py-3 relative">
        <div ref={waveformRef} />

        {!sourceUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500 pointer-events-none">
            Nessuna traccia caricata. Clicca su "Carica traccia".
          </div>
        )}
      </div>

      {/* controlli */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <button
            onClick={handleTogglePlay}
            disabled={!canPlay}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-500/90 disabled:bg-zinc-700 text-black text-xs font-semibold"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                Pausa
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Play
              </>
            )}
          </button>

          {/* download solo se ho un file caricato */}
          {sourceUrl && (
            <a
              href={sourceUrl}
              download={fileName || "track.wav"}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-zinc-600 hover:border-emerald-500/80 text-xs"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-1">
            {volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
            />
          </div>
          <div className="flex items-center gap-1 tabular-nums">
            <span className="text-zinc-300">
              {formatTime(currentTime)}
            </span>
            <span className="text-zinc-500">/</span>
            <span className="text-zinc-500">
              {duration ? formatTime(duration) : "0:00"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
