"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { supabase } from "@/lib/supabaseClient";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Repeat, Repeat1, Download, PlusCircle, Trash2, Upload, Target, Edit3
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
  dataUrl?: string;   // base64 per persistenza
  mimeType?: string;
  comments?: CommentItem[];
  description?: string;
};

type StoredTrack = {
  id: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  src?: string;
  filename?: string;
  dataUrl?: string;
  mimeType?: string;
  comments?: CommentItem[];
  description?: string;
};

type SoundCloudLikePlayerProps = {
  userId?: string;
  onUploaded?: () => void;
  audioUrl?: string;
  title?: string;
  artist?: string;
  genre?: string;
  initialComments?: CommentItem[];
  artworkUrl?: string;
  allowRateChange?: boolean;
  allowLoop?: boolean;
};

const PLAYLIST_KEY = "tekkin_playlist_v1";

function fmt(t: number) {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const dataUrlToFile = (dataUrl: string, filename: string, mimeType?: string) => {
  const arr = dataUrl.split(",");
  const mime = mimeType || arr[0].match(/:(.*?);/)?.[1] || "audio/wav";
  const bstr = atob(arr[1] ?? "");
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
};

const formatSupabaseError = (err: unknown) => {
  if (!err) return "Errore sconosciuto insert Supabase";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || err.name;
  const maybe = err as any;
  return (
    maybe.message ||
    maybe.error_description ||
    maybe.details ||
    maybe.hint ||
    maybe.code ||
    JSON.stringify(maybe, Object.getOwnPropertyNames(maybe))
  );
};

export default function SoundCloudPlaylistPlayer({ userId, onUploaded }: SoundCloudLikePlayerProps) {
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
  const [persistWarning, setPersistWarning] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<{ title: string; artist: string; description: string; artworkUrl: string }>({
    title: "",
    artist: "",
    description: "",
    artworkUrl: "",
  });
  const [scratching, setScratching] = useState(false);
  const scratchTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scratchTimer.current) {
        window.clearTimeout(scratchTimer.current);
        scratchTimer.current = null;
      }
    };
  }, []);

  const currentTrack = currentIndex >= 0 ? playlist[currentIndex] : null;
  const comments = currentTrack?.comments || [];

  // carica tracce da Supabase (persistenza vera) e fallback da localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      // 1. prova a caricare TUTTE le tracce da Supabase
      const { data: rows, error } = await supabase
        .from("tracks")
        .select("id,title,status,audio_url,cover_url,genre,notes,created_at")
        .order("created_at", { ascending: false });

      if (!error && rows && rows.length > 0) {
        const restoredFromSupabase: TrackItem[] = rows.map((row: any) => ({
          id: row.id,
          title: row.title || "Untitled",
          // non abbiamo colonna artist: uso status o genre come etichetta
          artist: row.status || "Uploaded",
          artworkUrl: row.cover_url || "/images/your-art.jpg",
          src: row.audio_url,
          filename: undefined,
          comments: [],
          description: row.notes || "",
        }));

        setPlaylist(restoredFromSupabase);
        setCurrentIndex(0);

        const first = restoredFromSupabase[0];
        setEditFields({
          title: first.title,
          artist: first.artist || "",
          description: first.description || "",
          artworkUrl: first.artworkUrl || "",
        });

        return; // abbiamo trovato roba su Supabase, non serve il fallback
      }
      if (error) {
        console.warn("Supabase tracks load error", error);
        setPlayerError("Impossibile caricare da Supabase, uso la cache locale.");
      }

      // 2. se Supabase non ha niente, fallback su localStorage
      const saved = window.localStorage.getItem(PLAYLIST_KEY);
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as StoredTrack[];
        const restored: TrackItem[] = parsed
          .map(t => {
            let file: File | undefined;
            let src = t.src;
            if (t.dataUrl) {
              try {
                file = dataUrlToFile(
                  t.dataUrl,
                  t.filename || `${t.title || "track"}.wav`,
                  t.mimeType
                );
                src = URL.createObjectURL(file);
              } catch (err) {
                console.warn("Impossibile ricreare il file dalla cache", err);
              }
            }
            const safeSrc = src || t.dataUrl;
            if (!safeSrc) return null;
            return {
              id: t.id,
              title: t.title,
              artist: t.artist,
              artworkUrl: t.artworkUrl,
              filename: t.filename,
              src: safeSrc,
              file,
              dataUrl: t.dataUrl,
              mimeType: t.mimeType,
              comments: t.comments || [],
              description: t.description,
            } as TrackItem;
          })
          .filter(Boolean) as TrackItem[];

        setPlaylist(restored);
        setCurrentIndex(restored.length > 0 ? 0 : -1);
      } catch (err) {
        console.error("Errore nel parsing playlist salvata", err);
      }
    })();
  }, [userId]);

  // salva playlist su localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const serialized: StoredTrack[] = playlist
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        artworkUrl: t.artworkUrl,
        filename: t.filename,
        // evitiamo di salvare blob:URL (non persistono)
        src: t.src?.startsWith("blob:") ? undefined : t.src,
        dataUrl: t.dataUrl,
        mimeType: t.mimeType,
        comments: t.comments || [],
        description: t.description,
      }))
      // se non abbiamo ne src ne dataUrl non salviamo
      .filter(t => t.src || t.dataUrl);

    try {
      const json = JSON.stringify(serialized);
      // limite prudenziale per evitare QuotaExceeded (valore indicativo)
      if (json.length > 4_500_000) {
        throw new Error("too_big");
      }
      window.localStorage.setItem(PLAYLIST_KEY, json);
      setPersistWarning(null);
    } catch (err) {
      console.warn("Playlist non salvata (quota piena o file troppo grande)", err);
      setPersistWarning(
        "Non posso salvare in locale: traccia troppo grande per lo storage del browser."
      );
    }
  }, [playlist]);

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

  const clearPlaylist = () => {
    setPlaylist([]);
    setCurrentIndex(-1);
    setPlayerError(null);
    setPersistWarning(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PLAYLIST_KEY);
    }
    setEditFields({ title: "", artist: "", description: "", artworkUrl: "" });
    setEditing(false);
  };

  useEffect(() => {
    const track = currentIndex >= 0 ? playlist[currentIndex] : null;
    if (!waveRef.current) return;
    if (!track) return;
    setPlayerError(null);

    const mediaEl = document.createElement("audio");
    mediaEl.preload = "auto";
    mediaEl.crossOrigin = "anonymous";

    const ws = WaveSurfer.create({
      container: waveRef.current,
      height: 142,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      waveColor: "rgba(255,255,255,0.55)",
      progressColor: "#ffffff",
      cursorColor: "#ffd166",
      normalize: true,
      minPxPerSec: 0,
      dragToSeek: true,
      autoCenter: false,
      backend: "MediaElement",
      media: mediaEl,
      mediaControls: false,
    });

    wsRef.current = ws;
    setReady(false);
    setPlaying(false);
    setCurrent(0);

    const handleReady = () => {
      setDuration(ws.getDuration());
      ws.setVolume(muted ? 0 : volume);
      ws.setPlaybackRate(rate);
      setCurrent(0);
      setPlaying(false);
      setReady(true);
    };

    const handleTimeUpdate = () => setCurrent(ws.getCurrentTime());
    const handleFinish = () => {
      setPlaying(false);
      if (loop) {
        ws.play(0);
        setPlaying(true);
      } else if (currentIndex < playlist.length - 1) {
        setCurrentIndex(i => i + 1);
      }
    };

    ws.on("ready", handleReady);
    ws.on("decode", handleReady);
    ws.on("timeupdate", handleTimeUpdate);
    ws.on("seeking", handleTimeUpdate);
    ws.on("finish", handleFinish);
    const handleError = (err: unknown) => {
      console.error("WaveSurfer error", err);
      setPlayerError("Impossibile caricare la traccia (formato non supportato o file corrotto).");
      setReady(false);
      setPlaying(false);
    };
    ws.on("error", handleError);

    let tempUrl: string | null = null;
    const rawSrc = track.file
      ? (tempUrl = URL.createObjectURL(track.file))
      : track.src || track.dataUrl || null;
    const srcToLoad =
      rawSrc && !rawSrc.startsWith("blob:") && !rawSrc.startsWith("data:") && typeof window !== "undefined"
        ? `${rawSrc.startsWith("/") ? window.location.origin : ""}${rawSrc}`
        : rawSrc;

    try {
      if (track.file) {
        ws.loadBlob(track.file);
      } else if (srcToLoad) {
        ws.load(srcToLoad);
      } else {
        console.warn("No audio source:", track);
      }
    } catch (err) {
      console.error("WaveSurfer load fallita", err);
      setPlayerError("Impossibile caricare la traccia.");
    }

    return () => {
      ws.un("ready", handleReady);
      ws.un("decode", handleReady);
      ws.un("timeupdate", handleTimeUpdate);
      ws.un("seeking", handleTimeUpdate);
      ws.un("finish", handleFinish);
      ws.un("error", handleError);
      try {
        ws.destroy();
      } catch {
        /* ignore AbortError */
      }
      if (tempUrl) URL.revokeObjectURL(tempUrl);
      wsRef.current = null;
      setReady(false);
      setPlaying(false);
      setCurrent(0);
      setDuration(0);
    };
  }, [currentIndex, loop]);

  // applica volume/muto dopo l'init del wavesurfer
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.setVolume(muted ? 0 : volume);
  }, [muted, volume]);

  // applica velocita
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.setPlaybackRate(rate);
  }, [rate]);



  // toggle play
  const togglePlay = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || !ready) return;

    if (playing) {
      const t = Math.max(0, ws.getCurrentTime() - 0.05);
      ws.setTime(t);
      ws.pause();
      setPlaying(false);
    } else {
      try {
        // forza resume dell'audio context se sospeso dal browser
        // @ts-expect-error: backend  interno a WaveSurfer
        ws.backend?.ac?.resume?.();
      } catch {
        // ignore
      }
      const t = Math.min(duration, ws.getCurrentTime() + 0.02);
      ws.setTime(t);
      ws.play();
      setPlaying(true);
    }
  }, [playing, ready, duration]);

  // scorciatoie tastiera
  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) {
        return;
      }

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

  const triggerScratch = useCallback(() => {
    setScratching(true);
    if (scratchTimer.current) {
      window.clearTimeout(scratchTimer.current);
    }
    scratchTimer.current = window.setTimeout(() => {
      setScratching(false);
    }, 180);
  }, []);

  const handleSeekPercent = (pct: number, setOnlyMarker = false) => {
    const ws = wsRef.current;
    if (!ws || duration === 0) return;
    const t = pct * duration;
    setSelectedTime(t);
    if (!setOnlyMarker) {
      ws.setTime(t);
      setCurrent(t);
      triggerScratch();
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

  // upload: salviamo sia File che objectURL, e pubblichiamo su Supabase (bucket tracks, tabella tracks)
  const onUpload = async (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const url = URL.createObjectURL(f);

    setUploadStatus(null);
    setPlayerError(null);

    // limitiamo la persistenza per non saturare localStorage
    const maxPersistBytes = 4_000_000; // circa 4MB
    let dataUrl: string | undefined;
    if (f.size <= maxPersistBytes) {
      dataUrl = await fileToDataUrl(f);
    } else {
      setPersistWarning(
        "Traccia troppo grande per essere salvata in locale. Rester finch la finestra  aperta."
      );
    }

    const baseTitle = f.name.replace(/\.[^/.]+$/, "");

    const newTrack: TrackItem = {
      id: `${Date.now()}`,
      title: baseTitle,
      artist: "Uploaded",
      description: "",
      src: url,
      filename: f.name,
      artworkUrl: "/images/your-art.jpg",
      file: f,
      dataUrl,
      mimeType: f.type,
      comments: [],
    };

    setPlaylist(prev => [newTrack, ...prev]);
    setCurrentIndex(0);
    setEditFields({
      title: baseTitle,
      artist: "Uploaded",
      description: "",
      artworkUrl: "/images/your-art.jpg",
    });

    // upload su Supabase storage e salva su tabella tracks (condiviso)
    setUploading(true);
    setUploadStatus("Caricamento su cloud in corso...");
    try {
      const folder = userId ? `user_${userId}` : "shared";
      const path = `${folder}/${Date.now()}_${f.name}`;
      const { error: upErr } = await supabase.storage.from("tracks").upload(path, f, {
        cacheControl: "3600",
        upsert: true,
      });
      if (upErr) {
        console.error("Upload Supabase fallito:", upErr);
        setPlayerError(`Errore upload Supabase: ${upErr.message}`);
        setUploadStatus("Errore di upload");
        return;
      }

      const { data: pub } = supabase.storage.from("tracks").getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (publicUrl) {
        const payload: any = {
          title: baseTitle,
          audio_url: publicUrl,
          cover_url: "/images/your-art.jpg",
        };

        if (userId) {
          payload.user_id = userId;
        }

        const { error: insertErr } = await supabase
          .from("tracks")
          .insert(payload);

        // lo consideriamo errore solo se c'è un messaggio o qualcosa di sensato
        const hasRealError =
          insertErr &&
          (insertErr as any).message &&
          String((insertErr as any).message).trim().length > 0;

        if (hasRealError) {
          const msg =
            (insertErr as any).message ||
            JSON.stringify(insertErr, null, 2) ||
            "Errore sconosciuto insert Supabase";

          console.error("Insert Supabase fallito:", insertErr);
          setPlayerError(`Errore insert Supabase: ${msg}`);
          setUploadStatus("Errore di upload");
          return;
        }

        // se arrivi qui, per noi è andato bene
        setPlaylist(prev => {
          if (prev.length === 0) return prev;
          const copy = [...prev];
          copy[0] = {
            ...copy[0],
            src: publicUrl,
          };
          return copy;
        });
        setUploadStatus("Caricato su Supabase");
        onUploaded?.();
      }
    } catch (err) {
      console.warn("Upload Supabase fallito", err);
      const msg = (err as any)?.message || "Errore generico upload Supabase.";
      setPlayerError(msg);
      setUploadStatus("Errore di upload");
    } finally {
      setUploading(false);
    }
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

  // RENDER
  return (
    <div className="w-full rounded-2xl border border-[#121826] bg-gradient-to-b from-[#0b101a] to-[#060910] text-slate-100 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.35)] relative">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(67,255,210,0.12),transparent_32%),radial-gradient(circle_at_80%_12%,rgba(249,115,22,0.08),transparent_28%)]" />
      </div>

      <div className="relative p-4 space-y-4">
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-[#1f2a3c] bg-[#0d141f] px-3 py-2 hover:bg-[#111a2a] cursor-pointer text-sm shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              <Upload size={16} />
              <span>Carica traccia</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={e => onUpload(e.target.files)}
              />
            </label>
            <button
              onClick={clearPlaylist}
              className="rounded-lg bg-[#111827] px-3 py-2 text-sm border border-[#1f2a3c] hover:bg-[#131d2e]"
              title="Svuota playlist locale"
            >
              Svuota playlist
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-[12px]">
            {playerError && <span className="rounded-full bg-red-500/15 border border-red-500/40 px-3 py-1 text-red-200">{playerError}</span>}
            {persistWarning && <span className="rounded-full bg-amber-500/15 border border-amber-500/40 px-3 py-1 text-amber-100">{persistWarning}</span>}
            {uploadStatus && <span className="rounded-full bg-cyan-500/15 border border-cyan-500/40 px-3 py-1 text-cyan-100">{uploadStatus}</span>}
            {!playerError && !persistWarning && !uploadStatus && (
              <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-white/70">
                {playlist.length > 0 ? `${playlist.length} tracce caricate` : "Nessuna traccia caricata"}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            {/* Now playing */}
            <div className="rounded-xl border border-[#1f2a3c] bg-[#0d141f]/70 p-4 flex items-center gap-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="h-16 w-16 overflow-hidden rounded-lg bg-[#0f0f0f] ring-1 ring-[#1f1f1f]/60 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentTrack?.artworkUrl || "/images/your-art.jpg"}
                  alt={currentTrack?.title || "artwork"}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-[#d9e0ea] truncate tracking-wide flex items-center gap-2">
                  <span>{currentTrack?.artist || "-"}</span>
                  {currentTrack && (
                    <button
                      onClick={() => {
                        setEditFields({
                          title: currentTrack.title,
                          artist: currentTrack.artist || "",
                          description: currentTrack.description || "",
                          artworkUrl: currentTrack.artworkUrl || "",
                        });
                        setEditing(true);
                      }}
                      className="rounded p-1 text-[#ffd166] hover:text-white hover:bg-[#182134] border border-transparent"
                      title="Modifica info traccia"
                    >
                      <Edit3 size={14} />
                    </button>
                  )}
                </div>
                <div className="truncate text-lg font-semibold">
                  {currentTrack?.title || "Nessuna traccia"}
                </div>
                <div className="mt-1 text-xs text-white/60">
                  {ready ? `Playing ${fmt(current)} / ${fmt(duration || 0)}` : "In attesa di caricare..."}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={prev}
                  className="rounded-lg bg-[#0f1725] p-2 hover:bg-[#131f32] border border-[#1f2a3c]"
                  title="Traccia precedente"
                >
                  <SkipBack size={16} />
                </button>
                <button
                  onClick={togglePlay}
                  className="flex items-center justify-center rounded-full bg-white/90 h-11 w-11 text-black shadow-[0_8px_20px_rgba(0,0,0,0.35)] hover:bg-white active:scale-[0.98]"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button
                  onClick={next}
                  className="rounded-lg bg-[#0f1725] p-2 hover:bg-[#131f32] border border-[#1f2a3c]"
                  title="Traccia successiva"
                >
                  <SkipForward size={16} />
                </button>
              </div>
            </div>

            {/* Waveform */}
            <div className="rounded-xl border border-[#1f2a3c] bg-[#090e16]/80 shadow-[0_14px_40px_rgba(0,0,0,0.35)] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white/90">Timeline</span>
                  <span className="text-xs text-white/60">{fmt(current)} / {fmt(duration || 0)}</span>
                  {selectedTime !== null && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] border border-white/10">
                      Marker {fmt(selectedTime)}
                    </span>
                  )}
                </div>
                {currentTrack && (
                  <a
                    href={currentTrack.src}
                    download={currentTrack.filename || `${currentTrack.title || "track"}.wav`}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#1f2a3c] bg-[#0d141f] px-3 py-1.5 text-xs hover:bg-[#0f1725]"
                  >
                    <Download size={14} />
                    Download
                  </a>
                )}
              </div>

              <div
                className="relative px-0 py-3"
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
                <div className="absolute inset-0 rounded-md bg-[#05070c]" />
                <div ref={waveRef} className="w-full relative z-[2]" />
                <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(transparent_55%,rgba(0,0,0,0.65))]" />
                <div className="pointer-events-none absolute inset-0 overflow-hidden z-[3]">
                  <div className="absolute left-0 right-0 h-3 top-1/3 bg-[#f97316]/10 animate-[tekkinSlice_2.2s_linear_infinite]" />
                  <div className="absolute left-0 right-0 h-[2px] top-[62%] bg-white/10 animate-[tekkinSlice_3s_linear_infinite]" />
                </div>
                {scratching && (
                  <div className="pointer-events-none absolute inset-0 z-[4] bg-[radial-gradient(circle_at_50%_50%,rgba(180,255,128,0.14),transparent_52%)] mix-blend-screen opacity-80 animate-[scratchFlash_0.18s_ease-out]" />
                )}

                {selectedTime !== null && duration > 0 && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-[3]"
                    style={{ left: `${(selectedTime / duration) * 100}%` }}
                  >
                    <div className="-translate-x-1/2 flex items-center gap-1">
                      <div className="h-full w-[2px] bg-[#f97316]" />
                      <div className="-translate-y-2 rounded bg-[#0c1414] px-2 py-1 text-[10px] border border-[#1f1f1f] text-[#f8f8f8] flex items-center gap-1">
                        <Target size={12} /> {fmt(selectedTime)}
                      </div>
                    </div>
                  </div>
                )}

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
                        <div className="h-3 w-[2px] bg-[#f97316] shadow-[0_0_10px_rgba(249,115,22,0.6)]" />
                      </button>
                    );
                  })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1f2a3c] bg-[#0c121d]/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="rounded-lg p-2 hover:bg-[#111a2a] border border-[#1f2a3c]"
                    title={muted ? "Riattiva audio" : "Muta audio"}
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
                    className="w-32 accent-[#f97316]"
                    aria-label="Volume"
                  />
                  <span className="text-xs text-white/60 w-10">{Math.round((muted ? 0 : volume) * 100)}%</span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={rate}
                    onChange={e => handleRate(parseFloat(e.target.value))}
                    className="rounded-lg border border-[#1f2a3c] bg-[#0d141f] px-2 py-1 text-sm"
                    aria-label="Playback speed"
                  >
                    <option value={0.75}>0.75x</option>
                    <option value={0.9}>0.90x</option>
                    <option value={1}>1.00x</option>
                    <option value={1.1}>1.10x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.50x</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Comments + playlist */}
          <div className="space-y-3">
            <div className="rounded-xl border border-[#1f2a3c] bg-[#0d141f]/80 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">Commenti</div>
                  <div className="text-sm text-white/80">Annota i momenti chiave</div>
                </div>
                <span className="text-[11px] text-white/50">{comments.length} note</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="rounded-full bg-[#0c1414] h-9 w-9 border border-[#1f2a3c]" />
                <input
                  id="comment-input"
                  value={commentDraft}
                  onChange={e => setCommentDraft(e.target.value)}
                  placeholder={`Commenta a ${fmt(selectedTime ?? current)}`}
                  className="flex-1 rounded-lg border border-[#1f2a3c] bg-[#0c1414] px-3 py-2 outline-none focus:border-[#43FFD2]"
                  onKeyDown={e => {
                    if (e.key === "Enter") addComment();
                  }}
                />
                <button
                  onClick={addComment}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#43FFD2] px-3 py-2 text-black hover:brightness-110 shadow-[0_10px_30px_rgba(67,255,210,0.35)]"
                >
                  <PlusCircle size={16} />
                  Commenta
                </button>
              </div>

              {comments.length > 0 && (
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                  {comments.map(c => (
                    <div key={c.id} className="flex items-start gap-2 text-sm rounded-lg bg-[#0b111b] border border-[#1f2a3c] px-3 py-2">
                      <div className="rounded-full bg-[#0c1414] h-7 w-7 border border-[#1f2a3c]" />
                      <div className="flex-1">
                        <div className="text-[#9adfd0] flex items-center gap-2">
                          <span className="font-medium text-zinc-200">You</span>
                          <button
                            className="rounded bg-[#0c1414] px-2 py-[2px] text-[11px] text-[#74ffe7] border border-[#1f2a3c] hover:bg-[#0e1818]"
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

            <div className="rounded-xl border border-[#1f2a3c] bg-[#0d141f]/80 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2a3c]">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">Playlist</div>
                  <div className="text-sm text-white/80">Archivio rapido</div>
                </div>
                <span className="text-[11px] text-white/50">{playlist.length} brani</span>
              </div>

              {playlist.length === 0 && (
                <div className="px-4 pb-4 pt-2 text-sm text-zinc-400">
                  Carica una traccia per iniziare.
                </div>
              )}

              {playlist.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left border-t border-[#121b2b] transition ${
                    i === currentIndex
                      ? "bg-gradient-to-r from-[#0a121c] to-[#0d1c2a] shadow-[0_6px_18px_rgba(0,0,0,0.3)]"
                      : "hover:bg-[#0f1725]"
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
                    {t.description && (
                      <div className="truncate text-[11px] text-slate-400">{t.description}</div>
                    )}
                  </div>
                  {i === currentIndex && (
                    <div className="ml-auto text-[12px] text-[#9adfd0]">
                      {fmt(duration)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
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
        @keyframes scratchFlash {
          0% { opacity: 0.85; transform: translateY(0); }
          60% { opacity: 0.42; transform: translateY(-2px); }
          100% { opacity: 0; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
