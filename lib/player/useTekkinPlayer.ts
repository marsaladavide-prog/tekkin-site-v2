"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
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

  volume: number; // 0..1
  isMuted: boolean;

  setAudioRef: (ref: RefObject<HTMLAudioElement> | null) => void;
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

export const useTekkinPlayer = create<TekkinPlayerState>()(
  persist(
    (set, get) => ({
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

      volume: 0.9,
      isMuted: false,

      setAudioRef: (ref) => {
        const prev = get().audioRef;
        if (prev === ref) return;

        set({ audioRef: ref });

        // FIX: se il player si apre e sta "playing" ma l'audioRef arriva dopo,
        // ributtiamo un playRequestId così l'effect che fa audio.play() riparte.
        const st = get();
        if (ref?.current && st.isOpen && st.isPlaying && st.audioUrl) {
          set({ playRequestId: st.playRequestId + 1 });
        }
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

      setVolume: (v) => {
        const next = clamp01(v);
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

              duration:
                Number.isFinite(payload.duration) && payload.duration
                  ? payload.duration
                  : 0,
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
        const nextReq = get().playRequestId + 1;

        set({
          isOpen: true,
          isPlaying: true,

          projectId: payload.projectId,
          versionId: payload.versionId,

          title: payload.title,
          subtitle: payload.subtitle ?? "",

          audioUrl: payload.audioUrl,

          duration:
            Number.isFinite(payload.duration) && payload.duration
              ? payload.duration
              : 0,
          currentTime: 0,

          pendingSeekRatio: r,

          playRequestId: nextReq,
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
        const d =
          Number.isFinite(get().duration) && get().duration > 0
            ? get().duration
            : a?.duration ?? 0;

        if (!a || !Number.isFinite(d) || d <= 0) return;

        const next = Math.max(0, Math.min(d, seconds));
        a.currentTime = next;
        set({ currentTime: next });
      },

      seekToRatio: (ratio) => {
        const a = get().audioRef?.current ?? null;
        const d =
          Number.isFinite(get().duration) && get().duration > 0
            ? get().duration
            : a?.duration ?? 0;

        if (!a || !Number.isFinite(d) || d <= 0) return;

        const r = clamp01(ratio);
        const next = r * d;
        a.currentTime = next;
        set({ currentTime: next });
      },

      applyPendingSeekIfPossible: () => {
        const st = get();
        const a = st.audioRef?.current ?? null;
        if (!a) return;
        if (st.pendingSeekRatio == null) return;

        const d =
          Number.isFinite(st.duration) && st.duration > 0 ? st.duration : a.duration;

        if (!Number.isFinite(d) || d <= 0) return;

        const next = clamp01(st.pendingSeekRatio) * d;
        a.currentTime = next;
        set({ currentTime: next, pendingSeekRatio: null });
      },

      clearPendingSeek: () => {
        if (get().pendingSeekRatio == null) return;
        set({ pendingSeekRatio: null });
      },
    }),
    {
      name: "tekkin_player_v1",
      partialize: (s) => ({
        volume: s.volume,
        isMuted: s.isMuted,
      }),
    }
  )
);
