"use client";

import { create } from "zustand";
import type { RefObject } from "react";

type AudioRef = RefObject<HTMLAudioElement | null>;

export type PlayPayload = {
  projectId?: string | null;
  versionId: string;
  title: string;
  subtitle?: string;
  audioUrl: string; // signed url, può cambiare
  duration?: number;
};

type TekkinPlayerState = {
  open: (payload: PlayPayload) => void;
  isOpen: boolean;
  isPlaying: boolean;

  projectId: string | null;
  versionId: string | null;

  title: string;
  subtitle: string;
  audioUrl: string | null;

  duration: number;
  currentTime: number;

  playRequestId: number;

  // Per evitare reload inutili con signed url diversi
  lastLoadedVersionId: string | null;

  audioRef: AudioRef | null;

  pendingSeekRatio: number | null;

  volume: number; // 0..1
  isMuted: boolean;

  setIsPlaying: (v: boolean) => void;

  toggle: () => void;
  setAudioRef: (ref: AudioRef) => void;
  setDuration: (d: number) => void;
  setCurrentTime: (t: number) => void;

  setVolume: (v: number) => void;
  toggleMute: () => void;

  play: (payload?: PlayPayload) => void;
  playAtRatio: (payload: PlayPayload, ratio: number) => void;

  pause: () => void;
  close: () => void;

  seekToSeconds: (seconds: number) => void;
  seekToRatio: (ratio: number) => void;

  applyPendingSeekIfPossible: () => void;
  clearPendingSeek: () => void;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function safePositive(n: unknown): number {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return 0;
  return x;
}

export const useTekkinPlayer = create<TekkinPlayerState>()((set, get) => ({
  open: (payload: PlayPayload) => get().play(payload),
  isOpen: false,
  isPlaying: false,

  projectId: null,
  versionId: null,

  title: "",
  subtitle: "",
  audioUrl: null,

  duration: 0,
  currentTime: 0,

  playRequestId: 0,

  lastLoadedVersionId: null,
  audioRef: null,

  pendingSeekRatio: null,

  volume: 0.9,
  isMuted: false,

  setIsPlaying: (v) => set({ isPlaying: !!v }),

  toggle: () => {
    const st = get();
    if (st.isPlaying) st.pause();
    else st.play();
  },

  setAudioRef: (ref) => {
    const prev = get().audioRef;
    if (prev === ref) return;
    set({ audioRef: ref });

    // Applica subito volume/mute allo stream reale
    const a = ref?.current ?? null;
    if (a) {
      const st = get();
      a.volume = st.volume;
      a.muted = st.isMuted;
    }
  },

  setDuration: (d) => {
    const next = safePositive(d);
    if (get().duration === next) return;
    set({ duration: next });
  },

  setCurrentTime: (t) => {
    const next = Math.max(0, Number.isFinite(t) ? t : 0);
    // evita set super spam
    if (Math.abs(get().currentTime - next) < 0.02) return;
    set({ currentTime: next });
  },

  setVolume: (v) => {
    const next = clamp01(Number.isFinite(v) ? v : 0.9);
    set({ volume: next });

    const a = get().audioRef?.current ?? null;
    if (a) a.volume = next;
  },

  toggleMute: () => {
    const next = !get().isMuted;
    set({ isMuted: next });

    const a = get().audioRef?.current ?? null;
    if (a) a.muted = next;
  },

  play: (payload) => {
    const st = get();

    // play() senza payload: riprendi se c'è una sorgente già impostata
    if (!payload) {
      if (!st.audioUrl || !st.versionId) return;
      set({
        isOpen: true,
        playRequestId: st.playRequestId + 1,
      });
      return;
    }

    const sameVersion = st.versionId === payload.versionId;

    if (sameVersion) {
      // Non toccare audioUrl qui: è signed, cambia spesso e crea mismatch UI.
      // Non incrementare playRequestId se stai già suonando.
      set({
        isOpen: true,
        title: payload.title,
        subtitle: payload.subtitle ?? "",
      });

      if (!st.isPlaying) {
        set({ playRequestId: st.playRequestId + 1 });
      }
      return;
    }

    // Nuova versione: reset sensato
    set({
      isOpen: true,
      isPlaying: false,
      projectId: payload.projectId ?? null,
      versionId: payload.versionId,
      title: payload.title,
      subtitle: payload.subtitle ?? "",
      audioUrl: payload.audioUrl,
      duration: safePositive(payload.duration),
      currentTime: 0,
      pendingSeekRatio: null,
      playRequestId: st.playRequestId + 1,
      lastLoadedVersionId: null, // forza reload nel floating
    });
  },

  playAtRatio: (payload, ratio) => {
    const r = clamp01(ratio);
    const st = get();

    const sameVersion = st.versionId === payload.versionId;

    if (sameVersion) {
      // stessa versione: non cambiare audioUrl (signed url cambia spesso)
      set({
        isOpen: true,
        pendingSeekRatio: r,
        title: payload.title,
        subtitle: payload.subtitle ?? "",
      });

      // retrigger play solo se non stai già suonando
      if (!st.isPlaying) {
        set({ playRequestId: st.playRequestId + 1 });
      } else {
        // se stai già suonando, applica seek appena possibile senza ripartire
        queueMicrotask(() => get().applyPendingSeekIfPossible());
      }

      return;
    }

    // nuova traccia
    set({
      isOpen: true,
      isPlaying: false,
      projectId: payload.projectId ?? null,
      versionId: payload.versionId,
      title: payload.title,
      subtitle: payload.subtitle ?? "",
      audioUrl: payload.audioUrl,
      duration: safePositive(payload.duration),
      currentTime: 0,
      pendingSeekRatio: r,
      playRequestId: st.playRequestId + 1,
      lastLoadedVersionId: null,
    });
  },

  pause: () => {
    const a = get().audioRef?.current ?? null;
    if (a) a.pause();
    set({ isPlaying: false });
  },

  close: () => {
    const a = get().audioRef?.current ?? null;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }

    set({
      isOpen: false,
      isPlaying: false,
      projectId: null,
      versionId: null,
      title: "",
      subtitle: "",
      audioUrl: null,
      duration: 0,
      currentTime: 0,
      pendingSeekRatio: null,
      lastLoadedVersionId: null,
    });
  },

  seekToSeconds: (seconds) => {
    const a = get().audioRef?.current ?? null;
    if (!a) return;

    const d = safePositive(get().duration) || safePositive(a.duration);
    if (!d) return;

    const next = Math.max(0, Math.min(d, Number(seconds)));
    a.currentTime = next;
    set({ currentTime: next });
  },

  seekToRatio: (ratio) => {
    const r = clamp01(ratio);
    const a = get().audioRef?.current ?? null;
    if (!a) return;

    const d = safePositive(get().duration) || safePositive(a.duration);
    if (!d) return;

    const next = r * d;
    a.currentTime = next;
    set({ currentTime: next });
  },

  applyPendingSeekIfPossible: () => {
    const st = get();
    const a = st.audioRef?.current ?? null;
    if (!a) return;

    const r = st.pendingSeekRatio;
    if (r == null) return;

    const d = safePositive(st.duration) || safePositive(a.duration);
    if (!d) return;

    const next = clamp01(r) * d;
    a.currentTime = next;
    set({ currentTime: next, pendingSeekRatio: null });
  },

  clearPendingSeek: () => set({ pendingSeekRatio: null }),
}));
