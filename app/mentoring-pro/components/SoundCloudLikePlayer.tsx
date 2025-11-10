"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Repeat, Repeat1, Download, Upload, Image as ImageIcon, Sparkles
} from "lucide-react";

// Tipi commenti
type CommentMarker = {
  id: string;
  author: string;
  text: string;
  atSeconds: number;
  avatarUrl?: string;
};

interface PlayerProps {
  audioUrl: string;              // traccia iniziale
  artworkUrl?: string;
  title: string;
  artist: string;
  genre?: string;
  initialComments?: CommentMarker[];
  initialPlays?: number;
  initialLikes?: number;
  allowRateChange?: boolean;
  allowLoop?: boolean;
}

type AnalysisResult = {
  bpm: number | null;
  bpmConf: number;              // 0..1
  key: string | null;           // es. "F#m" o "C"
  mode: "major" | "minor" | null;
  keyConf: number;              // 0..1
  brightness: number | null;    // 0..1 (spettral centroid normalizzato)
  suggestedGenre: string | null;
};

export default function SoundCloudLikePlayer({
  audioUrl,
  artworkUrl = "/images/your-art.jpg",
  title,
  artist,
  genre = "Minimal / Deep Tech",
  initialComments = [],
  allowRateChange = true,
  allowLoop = true,
}: PlayerProps) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  // sorgente audio attuale (può essere blob: dopo upload)
  const [currentSrc, setCurrentSrc] = useState<string>(audioUrl);
  const objectUrlRef = useRef<string | null>(null); // per revocare URL locali

  // cover
  const [artSrc, setArtSrc] = useState<string>(artworkUrl);
  const artObjUrlRef = useRef<string | null>(null);

  // metadati editabili
  const [titleEdit, setTitleEdit] = useState<string>(title);
  const [artistEdit, setArtistEdit] = useState<string>(artist);
  const [genreEdit, setGenreEdit] = useState<string>(genre);

  // player state
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(1);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);

  const [comments, setComments] = useState<CommentMarker[]>(initialComments);
  const [commentDraft, setCommentDraft] = useState("");

  // analisi
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult>({
    bpm: null, bpmConf: 0,
    key: null, mode: null, keyConf: 0,
    brightness: null,
    suggestedGenre: null,
  });

  // Inizializza WaveSurfer
  useEffect(() => {
    if (!waveRef.current) return;

    const ws = WaveSurfer.create({
      container: waveRef.current,
      height: 160,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      waveColor: "#2a2f31",
      progressColor: "#43FFD2",
      cursorColor: "transparent",
      normalize: true,
      autoCenter: false,
      autoScroll: false,
      dragToSeek: true,
      url: currentSrc,
    });

    wsRef.current = ws;

    const onReady = () => {
      setDuration(ws.getDuration());
      setReady(true);
      ws.setVolume(volume);
      ws.setPlaybackRate(rate);
      setCurrent(0);
      setPlaying(false);
    };
    const onTime = () => setCurrent(ws.getCurrentTime());
    const onFinish = () => {
      setPlaying(false);
      if (loop) {
        ws.play(0);
        setPlaying(true);
      }
    };

    ws.on("ready", onReady);
    ws.on("decode", onReady);
    ws.on("audioprocess", onTime);
    ws.on("seek", onTime);
    ws.on("finish", onFinish);

    return () => {
      ws.un("ready", onReady);
      ws.un("decode", onReady);
      ws.un("audioprocess", onTime);
      ws.un("seek", onTime);
      ws.un("finish", onFinish);
      ws.destroy();
      wsRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSrc, loop]);

  // pulizia objectURL quando cambia traccia/cover o unmount
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
      if (artObjUrlRef.current) { URL.revokeObjectURL(artObjUrlRef.current); artObjUrlRef.current = null; }
    };
  }, []);

  // Comandi
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

  const seekDelta = (delta: number) => {
    const ws = wsRef.current;
    if (!ws) return;
    const t = Math.min(Math.max(0, ws.getCurrentTime() + delta), duration);
    ws.setTime(t);
    setCurrent(t);
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

  // Tastiera
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        seekDelta(5);
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        seekDelta(-5);
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
  }, [current, togglePlay]);

  // Click waveform per cercare o solo marcare
  const clickWave = (e: React.MouseEvent<HTMLDivElement>, setOnlyMarker = false) => {
    if (!waveRef.current || duration === 0) return;
    const rect = waveRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const t = pct * duration;
    setSelectedTime(t);
    if (!setOnlyMarker) {
      const ws = wsRef.current;
      if (ws) {
        ws.setTime(t);
        setCurrent(t);
      }
    }
  };

  // Upload audio
  const onUpload = (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const url = URL.createObjectURL(f);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = url;
    setCurrentSrc(url);
    setComments([]); // reset commenti per nuova traccia locale
    setSelectedTime(null);
    // trigger analisi
    runAnalysis(url);
  };

  // Upload cover
  const onUploadCover = (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const url = URL.createObjectURL(f);
    if (artObjUrlRef.current) URL.revokeObjectURL(artObjUrlRef.current);
    artObjUrlRef.current = url;
    setArtSrc(url);
  };

  // Commenti
  const fmt = useCallback((t: number) => {
    if (!isFinite(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const addComment = () => {
    const text = commentDraft.trim();
    if (!text) return;
    const at = selectedTime !== null ? selectedTime : current;
    const c: CommentMarker = { id: `${Date.now()}`, author: "You", text, atSeconds: at };
    const updated = [...comments, c].sort((a, b) => a.atSeconds - b.atSeconds);
    setComments(updated);
    setCommentDraft("");
  };

  const removeComment = (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id));
  };

  const currentPct = useMemo(
    () => (duration > 0 ? current / duration : 0),
    [current, duration]
  );

  // ANALISI: decode + BPM + KEY + brightness + genere
  const runAnalysis = async (src: string) => {
    setAnalyzing(true);
    try {
      // fetch dell’audio (funziona anche su blob:)
      const resp = await fetch(src);
      const ab = await resp.arrayBuffer();

      // decode
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffer = await audioCtx.decodeAudioData(ab);

      // 1) BPM
      const { bpm, conf: bpmConf } = estimateBPM(buffer);

      // 2) Key (chroma con Goertzel su più ottave)
      const { keyName, mode, conf: keyConf } = estimateKey(buffer);

      // 3) Brightness (spettral centroid normalizzato)
      const brightness = estimateBrightness(buffer);

      // 4) Genere suggerito (heuristics)
      const suggestedGenre = suggestGenre(bpm, brightness);

      setAnalysis({
        bpm, bpmConf,
        key: keyName, mode,
        keyConf,
        brightness,
        suggestedGenre,
      });

      audioCtx.close();
    } catch (err) {
      console.error("Analysis error:", err);
      setAnalysis({
        bpm: null, bpmConf: 0,
        key: null, mode: null, keyConf: 0,
        brightness: null,
        suggestedGenre: null,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Auto-analizza anche la traccia iniziale se è servita da /public (evita 404)
  useEffect(() => {
    if (!audioUrl) return;
    // prova HEAD per vedere se esiste
    (async () => {
      try {
        const ok = await fetch(audioUrl, { method: "HEAD", cache: "no-store" }).then(r => r.ok).catch(() => false);
        if (ok) runAnalysis(audioUrl);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === Algoritmi di analisi ===================================================

  function estimateBPM(buffer: AudioBuffer): { bpm: number | null; conf: number } {
    // downmix mono
    const ch = buffer.numberOfChannels > 0 ? buffer.getChannelData(0) : new Float32Array(0);
    if (ch.length < buffer.sampleRate * 2) return { bpm: null, conf: 0 };

    // downsample a ~2kHz per envelope (performance)
    const targetSR = 2000;
    const step = Math.max(1, Math.floor(buffer.sampleRate / targetSR));
    const ds = new Float32Array(Math.floor(ch.length / step));
    for (let i = 0, j = 0; i < ch.length; i += step, j++) ds[j] = ch[i];

    // energy envelope tramite abs + smooth
    for (let i = 0; i < ds.length; i++) ds[i] = Math.abs(ds[i]);
    smoothInPlace(ds, 16);

    // autocorrelazione su lags per 60..200 BPM
    const minBpm = 60, maxBpm = 200;
    const minLag = Math.floor(targetSR * 60 / maxBpm);
    const maxLag = Math.floor(targetSR * 60 / minBpm);

    const ac = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i + lag < ds.length; i++) sum += ds[i] * ds[i + lag];
      ac[lag] = sum;
    }

    // pick del massimo con harmonics folding sui multipli/ sottomultipli (x2, /2)
    let bestLag = -1, bestScore = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let score = ac[lag];
      const h2 = lag * 2; if (h2 <= maxLag) score += 0.5 * ac[h2];
      const h3 = lag * 3; if (h3 <= maxLag) score += 0.25 * ac[h3];
      const d2 = Math.floor(lag / 2); if (d2 >= minLag) score += 0.5 * ac[d2];
      if (score > bestScore) { bestScore = score; bestLag = lag; }
    }

    if (bestLag < 0) return { bpm: null, conf: 0 };
    const bpm = Math.round((60 * targetSR) / bestLag);

    // conf normalizzata
    const conf = bestScore > 0 ? Math.min(1, bestScore / (ac[minLag] + 1e-6)) : 0.5;
    // porta BPM in range “dance” se necessario (moltiplica/divide per 2)
    const adj = normalizeBPM(bpm);
    return { bpm: adj, conf: Math.max(0.2, Math.min(conf, 0.99)) };
  }

  function normalizeBPM(bpm: number): number {
    let x = bpm;
    while (x < 100) x *= 2;
    while (x > 190) x /= 2;
    return Math.round(x);
  }

  function estimateBrightness(buffer: AudioBuffer): number {
    // calcolo semplice di spectral centroid su finestre sparse
    const ch = buffer.getChannelData(0);
    const sr = buffer.sampleRate;
    const hop = Math.floor(sr * 0.05); // 50 ms
    const win = Math.floor(sr * 0.1);  // 100 ms
    let accum = 0, count = 0;
    for (let i = 0; i + win < ch.length; i += hop * 10) {
      const seg = ch.subarray(i, i + win);
      const { centroid } = centroidNoFFT(seg, sr);
      accum += centroid;
      count++;
    }
    const mean = count ? accum / count : 0;
    // normalizza ~ 200Hz..7000Hz in 0..1
    const min = 200, max = 7000;
    const n = Math.min(1, Math.max(0, (mean - min) / (max - min)));
    return n;
  }

  function centroidNoFFT(frame: Float32Array, sr: number): { centroid: number } {
    // pseudo-centroid: usa zero-crossing weighted + energia come proxy
    // è molto approssimato ma sufficiente per una “brightness” grossolana
    let crossings = 0;
    for (let i = 1; i < frame.length; i++) {
      if ((frame[i - 1] >= 0 && frame[i] < 0) || (frame[i - 1] < 0 && frame[i] >= 0)) crossings++;
    }
    const freq = (crossings / (frame.length / sr)) / 2; // stima rozza
    const centroid = Math.max(50, Math.min(9000, freq * 6)); // scala empirica
    return { centroid };
  }

  // Key detection (chroma con Goertzel su 5 ottave, 12 classi, Krumhansl)
  function estimateKey(buffer: AudioBuffer): { keyName: string | null; mode: "major" | "minor" | null; conf: number } {
    const sr = buffer.sampleRate;
    const ch = buffer.getChannelData(0);

    // parametri
    const frameSize = 4096;
    const hop = 2048;
    const minFreq = 110;   // A2
    const maxFreq = 1760;  // A6
    const octaves = 5;

    // precompute frequenze pitch-class per più ottave
    const A4 = 440;
    const pcFreqs: number[] = [];
    for (let o = -2; o < 3; o++) { // 5 ottave intorno ad A4
      for (let pc = 0; pc < 12; pc++) {
        const freq = A4 * Math.pow(2, (pc - 9) / 12) * Math.pow(2, o); // pc 9 ~= A
        if (freq >= minFreq && freq <= maxFreq) pcFreqs.push(freq);
      }
    }

    const chroma = new Float32Array(12);

    const tmp = new Float32Array(frameSize);
    for (let start = 0; start + frameSize < ch.length; start += hop * 8) {
      // finestra Hann
      for (let i = 0; i < frameSize; i++) {
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
        tmp[i] = ch[start + i] * w;
      }

      // Goertzel per ciascuna freq -> accumula su pitch class
      for (let f = 0; f < pcFreqs.length; f++) {
        const freq = pcFreqs[f];
        const k = Math.round(0.5 + ((frameSize * freq) / sr));
        const w = (2 * Math.PI * k) / frameSize;
        let s_prev = 0, s_prev2 = 0;
        const cos = Math.cos(w);
        const coeff = 2 * cos;
        for (let n = 0; n < frameSize; n++) {
          const s = tmp[n] + coeff * s_prev - s_prev2;
          s_prev2 = s_prev;
          s_prev = s;
        }
        const power = s_prev2 * s_prev2 + s_prev * s_prev - coeff * s_prev * s_prev2;

        // pitch class index (C=0, C#=1, ... B=11)
        const pc = ((Math.round(12 * Math.log2(freq / 261.6255653005986)) % 12) + 12) % 12; // 261.625.. = C4
        chroma[pc] += power;
      }
    }

    // normalizza
    const sum = chroma.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < 12; i++) chroma[i] /= sum;

    // profili Krumhansl (normalizzati grossolanamente)
    const majorProfile = normalize([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]);
    const minorProfile = normalize([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]);

    // prova tutti i 12 shift (C..B) per maggiore/minore
    let bestKey = 0, bestMode: "major" | "minor" = "major", bestScore = -Infinity;

    for (let tonic = 0; tonic < 12; tonic++) {
      const rotated = rotate(chroma, tonic);
      const scoreMaj = dot(rotated, majorProfile);
      const scoreMin = dot(rotated, minorProfile);
      if (scoreMaj > bestScore) { bestScore = scoreMaj; bestKey = tonic; bestMode = "major"; }
      if (scoreMin > bestScore) { bestScore = scoreMin; bestKey = tonic; bestMode = "minor"; }
    }

    const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    const keyName = bestMode === "major" ? names[bestKey] : names[bestKey] + "m";

    // conf: distanza da seconda scelta
    const scores: Array<{name:string,score:number}> = [];
    for (let tonic = 0; tonic < 12; tonic++) {
      scores.push({ name: names[tonic], score: dot(rotate(chroma, tonic), majorProfile) });
      scores.push({ name: names[tonic]+"m", score: dot(rotate(chroma, tonic), minorProfile) });
    }
    scores.sort((a,b)=>b.score-a.score);
    const conf = scores.length >= 2 ? Math.min(1, Math.max(0, (scores[0].score - scores[1].score) / (scores[0].score + 1e-6))) : 0.4;

    return { keyName, mode: bestMode, conf: conf };
  }

  function normalize(arr: number[]): number[] {
    const s = arr.reduce((a,b)=>a+b,0) || 1;
    return arr.map(v=>v/s);
    }

  function rotate(vec: Float32Array, n: number): Float32Array {
    const out = new Float32Array(12);
    for (let i=0;i<12;i++) out[i] = vec[(i+n)%12];
    return out;
  }

  function dot(a: Float32Array, b: number[]): number {
    let s = 0;
    for (let i=0;i<a.length;i++) s += a[i]*b[i];
    return s;
  }

  function smoothInPlace(x: Float32Array, win: number) {
    let acc = 0;
    const q: number[] = [];
    for (let i = 0; i < x.length; i++) {
      q.push(x[i]); acc += x[i];
      if (q.length > win) acc -= q.shift()!;
      x[i] = acc / q.length;
    }
  }

  function suggestGenre(bpm: number | null, brightness: number | null): string | null {
    if (!bpm) return null;
    // heuristics molto semplici per dance
    if (bpm >= 116 && bpm <= 124) {
      if ((brightness ?? 0.4) < 0.45) return "Deep House / Minimal";
      return "House / Tech House";
    }
    if (bpm > 124 && bpm <= 130) {
      if ((brightness ?? 0.5) > 0.55) return "Tech House";
      return "House / Tech House";
    }
    if (bpm > 130 && bpm <= 138) {
      if ((brightness ?? 0.6) > 0.6) return "Techno (Peak/Driving)";
      return "Techno / Melodic Techno";
    }
    if (bpm > 138 && bpm <= 150) return "Hardgroove / Hard Techno / Breaks";
    if (bpm < 100) return "Downtempo / Hip-Hop";
    if (bpm >= 100 && bpm < 116) return "UK Garage / Breakbeat / Afro House";
    if (bpm > 150) return "Hard Techno / DnB?";
    return "Electronic";
  }

  // =============================================================================

  return (
    <div className="w-full rounded-2xl border border-[#111718] bg-[#0a0e0f] text-zinc-100 overflow-hidden shadow-[0_0_24px_rgba(67,255,210,0.08)]">
      {/* Header con metadati editabili */}
      <div className="flex items-center gap-4 p-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-md bg-[#121718] ring-1 ring-[#1c2628]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artSrc} alt={titleEdit} className="h-full w-full object-cover" />
          <label className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] cursor-pointer">
            <ImageIcon size={12} />
            <span>Cover</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e)=>onUploadCover(e.target.files)} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
          <input
            value={titleEdit}
            onChange={e=>setTitleEdit(e.target.value)}
            className="rounded border border-[#1c2628] bg-[#0f1516] px-3 py-2 outline-none focus:border-[#43FFD2]"
            placeholder="Titolo traccia"
          />
          <input
            value={artistEdit}
            onChange={e=>setArtistEdit(e.target.value)}
            className="rounded border border-[#1c2628] bg-[#0f1516] px-3 py-2 outline-none focus:border-[#43FFD2]"
            placeholder="Artista"
          />
          <input
            value={genreEdit}
            onChange={e=>setGenreEdit(e.target.value)}
            className="rounded border border-[#1c2628] bg-[#0f1516] px-3 py-2 outline-none focus:border-[#43FFD2]"
            placeholder="Genere"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Upload audio */}
          <label className="inline-flex items-center gap-2 rounded-md border border-[#1c2628] bg-[#0f1516] px-3 py-2 hover:bg-[#121a1b] cursor-pointer text-sm">
            <Upload size={16} />
            <span>Upload</span>
            <input type="file" accept="audio/*" className="hidden" onChange={(e) => onUpload(e.target.files)} />
          </label>

          {/* Download corrente */}
          <a
            href={currentSrc}
            download={(titleEdit || "track").replace(/\s+/g, "_") + ".wav"}
            className="inline-flex items-center gap-2 rounded-md border border-[#1c2628] bg-[#0f1516] px-3 py-2 hover:bg-[#121a1b] text-sm"
            title="Download"
          >
            <Download size={16} />
            Download
          </a>
        </div>
      </div>

      {/* Waveform full-width con background sotto */}
      <div
        className="relative px-4 pb-2 select-none"
        onClick={(e) => clickWave(e, false)}
        onContextMenu={(e) => { e.preventDefault(); clickWave(e, true); }}
      >
        <div ref={waveRef} className="w-full relative z-[2] h-[160px]" />

        {/* Background pulito e professionale sotto la wave */}
        <div className="pointer-events-none absolute inset-0 z-[1]">
          {/* scanlines leggere */}
          <div className="absolute inset-0 opacity-[0.06] [background:repeating-linear-gradient(0deg,transparent,transparent_2px,#000_3px)]" />
          {/* grana fine */}
          <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:3px_3px]" />
          {/* vignetta */}
          <div className="absolute inset-0 bg-[radial-gradient(transparent_65%,rgba(10,16,17,0.55))]" />
        </div>

        {/* progress highlight elegante */}
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 z-[2]"
          style={{
            width: `${currentPct * 100}%`,
            background:
              "linear-gradient(90deg, rgba(67,255,210,0.20), rgba(0,255,255,0.10))",
            mixBlendMode: "screen",
          }}
        />

        {/* markers commenti */}
        {duration > 0 &&
          comments.map((c) => {
            const pct = Math.min(1, Math.max(0, c.atSeconds / duration));
            return (
              <button
                key={c.id}
                title={`${c.author}: ${c.text}`}
                className="absolute top-2 -translate-x-1/2 z-[3]"
                style={{ left: `${pct * 100}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  const ws = wsRef.current;
                  if (!ws) return;
                  ws.setTime(c.atSeconds);
                  setCurrent(c.atSeconds);
                  setSelectedTime(c.atSeconds);
                }}
              >
                <div className="h-3 w-[2px] bg-[#8feedd] shadow-[0_0_8px_rgba(67,255,210,0.5)]" />
              </button>
            );
          })}
      </div>

      {/* Barra controlli in basso, stile DAW pro */}
      <div className="flex flex-wrap items-center gap-3 px-4 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => seekDelta(-5)}
            className="rounded-md bg-[#0f1516] p-2 border border-[#1c2628] hover:bg-[#121a1b]"
            title="-5s"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlay}
            className="flex items-center gap-2 rounded-md bg-[#43FFD2] px-4 py-2 text-black font-medium hover:brightness-110 active:scale-[0.98]"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => seekDelta(5)}
            className="rounded-md bg-[#0f1516] p-2 border border-[#1c2628] hover:bg-[#121a1b]"
            title="+5s"
          >
            <SkipForward size={16} />
          </button>
        </div>

        <div className="rounded bg-[#0f1516] px-2 py-1 border border-[#1c2628] text-xs">
          {isFinite(current) ? `${fmt(current)} / ${fmt(duration)}` : "0:00 / 0:00"}
        </div>

        {allowLoop && (
          <button
            onClick={() => setLoop(v => !v)}
            className={`rounded-md p-2 border ${
              loop ? "bg-[#43FFD2] text-black border-[#43FFD2]" : "bg-[#0f1516] hover:bg-[#121a1b] border-[#1c2628]"
            }`}
            title="Loop"
          >
            {loop ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="rounded p-1.5 hover:bg-[#0f1516] border border-[#1c2628]">
              {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => handleVolume(parseFloat(e.target.value))}
              className="w-32 accent-[#43FFD2]"
              aria-label="Volume"
            />
          </div>

          {allowRateChange && (
            <select
              value={rate}
              onChange={(e) => handleRate(parseFloat(e.target.value))}
              className="rounded border border-[#1c2628] bg-[#0f1516] px-2 py-1 text-sm"
              aria-label="Playback speed"
            >
              <option value={0.75}>0.75x</option>
              <option value={0.9}>0.90x</option>
              <option value={1}>1.00x</option>
              <option value={1.1}>1.10x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.50x</option>
            </select>
          )}
        </div>
      </div>

      {/* Pannello Analisi */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 text-[#8feedd]">
          <Sparkles size={16} />
          <div className="font-medium">Analyzer</div>
          <div className="ml-auto text-xs text-zinc-400">
            {analyzing ? "Analisi in corso…" : "Pronto"}
          </div>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-4">
          <div className="rounded-md border border-[#1c2628] bg-[#0f1516] p-3">
            <div className="text-xs text-zinc-400">BPM</div>
            <div className="text-lg font-semibold">
              {analysis.bpm ?? "—"}
              {analysis.bpm ? <span className="ml-2 text-xs text-zinc-400">({Math.round(analysis.bpmConf*100)}%)</span> : null}
            </div>
          </div>
          <div className="rounded-md border border-[#1c2628] bg-[#0f1516] p-3">
            <div className="text-xs text-zinc-400">Key</div>
            <div className="text-lg font-semibold">
              {analysis.key ?? "—"}
              {analysis.key ? <span className="ml-2 text-xs text-zinc-400">({Math.round(analysis.keyConf*100)}%)</span> : null}
            </div>
          </div>
          <div className="rounded-md border border-[#1c2628] bg-[#0f1516] p-3">
            <div className="text-xs text-zinc-400">Brightness</div>
            <div className="text-lg font-semibold">
              {analysis.brightness !== null ? `${Math.round((analysis.brightness)*100)}%` : "—"}
            </div>
          </div>
          <div className="rounded-md border border-[#1c2628] bg-[#0f1516] p-3">
            <div className="text-xs text-zinc-400">Genere suggerito</div>
            <div className="text-lg font-semibold">
              {analysis.suggestedGenre ?? "—"}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-400">
          Tip: carica la tua **WAV/AIFF/MP3** e l’analizzatore proverà a stimare BPM, Key e un genere indicativo.
          Le stime sono approssimate e pensate per workflow rapidi.
        </div>
      </div>

      {/* Commenti */}
      <div className="border-t border-[#121718] px-4 pb-4">
        <div className="flex items-center gap-2 pt-3">
          <div className="rounded-full bg-[#0f1516] h-8 w-8 border border-[#1c2628]" />
          <input
            id="comment-input"
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder={`Commenta a ${fmt(selectedTime ?? current)}`}
            className="flex-1 rounded border border-[#1c2628] bg-[#0f1516] px-3 py-2 outline-none focus:border-[#43FFD2]"
            onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
          />
          <button
            onClick={addComment}
            className="inline-flex items-center gap-2 rounded-md bg-[#43FFD2] px-3 py-2 text-black hover:brightness-110"
          >
            Aggiungi
          </button>
        </div>

        {comments.length > 0 && (
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm">
                <div className="rounded-full bg-[#0f1516] h-7 w-7 border border-[#1c2628]" />
                <div className="flex-1">
                  <div className="text-[#a9e9dd]">
                    <span className="font-medium text-zinc-200">{c.author}</span>
                    <button
                      className="ml-2 rounded bg-[#0f1516] px-2 py-[2px] text-[11px] text-[#8feedd] border border-[#1c2628] hover:bg-[#121a1b]"
                      onClick={() => {
                        const ws = wsRef.current;
                        if (!ws) return;
                        ws.setTime(c.atSeconds);
                        setCurrent(c.atSeconds);
                        setSelectedTime(c.atSeconds);
                      }}
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
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
