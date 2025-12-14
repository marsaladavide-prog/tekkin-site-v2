"use client";

import { create } from "zustand";
import type { RefObject } from "react";

type PlayPayload = {
  projectId: string;
  versionId: string;
  title: string;
  subtitle?: string;
  audioUrl: string;
  duration?: number;
};

type TekkinPlayerState = {
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

  audioRef: RefObject<HTMLAudioElement> | null;

  pendingSeekRatio: number | null;

  setAudioRef: (ref: RefObject<HTMLAudioElement> | null) => void;
  setDuration: (d: number) => void;
  setCurrentTime: (t: number) => void;

  play: (payload?: PlayPayload) => void;
  playAtRatio: (payload: PlayPayload, ratio: number) => void;

  pause: () => void;
  close: () => void;

  seekToSeconds: (seconds: number) => void;
  seekToRatio: (ratio: number) => void;

  clearPendingSeek: () => void;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export const useTekkinPlayer = create<TekkinPlayerState>((set, get) => ({
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

  audioRef: null,

  pendingSeekRatio: null,

  setAudioRef: (ref) => {
    if (get().audioRef === ref) return;
    set({ audioRef: ref });
  },

  setDuration: (d) => {
    const next = Number.isFinite(d) && d > 0 ? d : 0;
    if (get().duration === next) return;
    set({ duration: next });
  },

  setCurrentTime: (t) => {
    const next = Number.isFinite(t) && t >= 0 ? t : 0;
    if (Math.abs(get().currentTime - next) < 0.02) return;
    set({ currentTime: next });
  },

  play: (payload) => {
    const st = get();

    if (payload) {
      const isSame =
        st.audioUrl === payload.audioUrl && st.versionId === payload.versionId;

      if (!isSame) {
        set({
          isOpen: true,
          isPlaying: true,

          projectId: payload.projectId,
          versionId: payload.versionId,

          title: payload.title,
          subtitle: payload.subtitle ?? "",

          audioUrl: payload.audioUrl,

          duration: Number.isFinite(payload.duration) && payload.duration ? payload.duration : 0,
          currentTime: 0,

          pendingSeekRatio: null,

          playRequestId: st.playRequestId + 1,
        });
        return;
      }

      set({
        isOpen: true,
        isPlaying: true,
        playRequestId: st.playRequestId + 1,
      });
      return;
    }

    if (!st.audioUrl) return;
    set({
      isOpen: true,
      isPlaying: true,
      playRequestId: st.playRequestId + 1,
    });
  },

  playAtRatio: (payload, ratio) => {
    const r = clamp01(ratio);
    set({
      isOpen: true,
      isPlaying: true,

      projectId: payload.projectId,
      versionId: payload.versionId,

      title: payload.title,
      subtitle: payload.subtitle ?? "",

      audioUrl: payload.audioUrl,

      duration: Number.isFinite(payload.duration) && payload.duration ? payload.duration : 0,
      currentTime: 0,

      pendingSeekRatio: r,

      playRequestId: get().playRequestId + 1,
    });
  },

  pause: () => {
    if (!get().isPlaying) return;
    set({ isPlaying: false });
  },

  close: () => {
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
    });
  },

  seekToSeconds: (seconds) => {
    const a = get().audioRef?.current ?? null;
    const d = Number.isFinite(get().duration) && get().duration > 0 ? get().duration : (a?.duration ?? 0);

    if (!a || !Number.isFinite(d) || d <= 0) return;

    const next = Math.max(0, Math.min(d, seconds));
    a.currentTime = next;
    set({ currentTime: next });
  },

  seekToRatio: (ratio) => {
    const a = get().audioRef?.current ?? null;
    const d = Number.isFinite(get().duration) && get().duration > 0 ? get().duration : (a?.duration ?? 0);

    if (!a || !Number.isFinite(d) || d <= 0) return;

    const r = clamp01(ratio);
    const next = r * d;
    a.currentTime = next;
    set({ currentTime: next });
  },

  clearPendingSeek: () => {
    if (get().pendingSeekRatio == null) return;
    set({ pendingSeekRatio: null });
  },
}));
