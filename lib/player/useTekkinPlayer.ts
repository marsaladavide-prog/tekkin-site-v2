"use client";

import { create } from "zustand";
import type { RefObject } from "react";
import type { TrackCollabBadge } from "@/lib/tracks/types";

type AudioRef = RefObject<HTMLAudioElement | null>;

export type PlayPayload = {
  projectId?: string | null;
  versionId: string;
  title: string;
  subtitle?: string;
  collabBadges?: TrackCollabBadge[] | null;
  audioUrl: string; // signed url, può cambiare
  duration?: number;
  artistId?: string | null;
  artistSlug?: string | null;
  coverUrl?: string | null;
};

export type TekkinPlayerState = {
  open: (payload: PlayPayload) => void;
  isOpen: boolean;
  isPlaying: boolean;

  projectId: string | null;
  versionId: string | null;

  title: string;
  subtitle: string;
  collabBadges: TrackCollabBadge[] | null;
  audioUrl: string | null;
  artistId: string | null;
  artistSlug: string | null;

  duration: number;
  currentTime: number;

  playRequestId: number;
  playToken: number;

  // Per evitare reload inutili con signed url diversi
  lastLoadedVersionId: string | null;

  audioRef: AudioRef | null;

  pendingSeekRatio: number | null;

  volume: number; // 0..1
  isMuted: boolean;

  coverUrl?: string | null;

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

function preserveValue<T>(incoming: T | null | undefined, previous: T | null | undefined): T | null | undefined {
  return incoming == null ? previous : incoming;
}

export const useTekkinPlayer = create<TekkinPlayerState>()((set, get) => ({
  open: (payload: PlayPayload) => get().play(payload),
  isOpen: false,
  isPlaying: false,

  projectId: null,
  versionId: null,

  title: "",
  subtitle: "",
  collabBadges: null,
  audioUrl: null,
  artistId: null,
  artistSlug: null,

  duration: 0,
  currentTime: 0,

  playRequestId: 0,
  playToken: 0,

  lastLoadedVersionId: null,
  audioRef: null,

  pendingSeekRatio: null,

  volume: 0.9,
  isMuted: false,
  coverUrl: null,

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

    if (!payload) {
      if (!st.audioUrl || !st.versionId) return;
      set({
        isOpen: true,
        playRequestId: st.playRequestId + 1,
      });
      return;
    }

    const nextToken = st.playToken + 1;
    const sameVersion = st.versionId === payload.versionId;

    const mergedTitle = preserveValue(payload.title, st.title) ?? "";
    const mergedSubtitle = preserveValue(payload.subtitle, st.subtitle) ?? "";
    const mergedCollabBadges = preserveValue(payload.collabBadges ?? null, st.collabBadges ?? null) ?? null;
    const mergedArtistId = preserveValue(payload.artistId ?? null, st.artistId ?? null) ?? null;
    const mergedArtistSlug = preserveValue(payload.artistSlug ?? null, st.artistSlug ?? null) ?? null;
    const mergedCoverUrl = preserveValue(payload.coverUrl ?? null, st.coverUrl ?? null) ?? null;
    const mergedProjectId = preserveValue(payload.projectId ?? null, st.projectId ?? null) ?? null;

    if (sameVersion) {
      set({
        isOpen: true,
        playToken: nextToken,
        title: mergedTitle,
        subtitle: mergedSubtitle,
        collabBadges: mergedCollabBadges,
        artistId: mergedArtistId,
        artistSlug: mergedArtistSlug,
        coverUrl: mergedCoverUrl,
        projectId: mergedProjectId,
      });

      if (!st.isPlaying) {
        set({ playRequestId: st.playRequestId + 1 });
      }
      return;
    }

    const mergedAudioUrl = payload.audioUrl ?? st.audioUrl ?? null;

    set({
      isOpen: true,
      isPlaying: false,
      projectId: mergedProjectId,
      versionId: payload.versionId,
      title: mergedTitle,
      subtitle: mergedSubtitle,
      collabBadges: mergedCollabBadges,
      artistId: mergedArtistId,
      artistSlug: mergedArtistSlug,
      audioUrl: mergedAudioUrl,
      coverUrl: mergedCoverUrl,
      duration: safePositive(payload.duration),
      currentTime: 0,
      pendingSeekRatio: null,
      playRequestId: st.playRequestId + 1,
      lastLoadedVersionId: null,
      playToken: nextToken,
    });
  },

  playAtRatio: (payload, ratio) => {
    const r = clamp01(ratio);
    const st = get();

    const nextToken = st.playToken + 1;
    const sameVersion = st.versionId === payload.versionId;

    const mergedTitle = preserveValue(payload.title, st.title) ?? "";
    const mergedSubtitle = preserveValue(payload.subtitle, st.subtitle) ?? "";
    const mergedCollabBadges = preserveValue(payload.collabBadges ?? null, st.collabBadges ?? null) ?? null;
    const mergedArtistId = preserveValue(payload.artistId ?? null, st.artistId ?? null) ?? null;
    const mergedArtistSlug = preserveValue(payload.artistSlug ?? null, st.artistSlug ?? null) ?? null;
    const mergedCoverUrl = preserveValue(payload.coverUrl ?? null, st.coverUrl ?? null) ?? null;
    const mergedProjectId = preserveValue(payload.projectId ?? null, st.projectId ?? null) ?? null;
    const mergedAudioUrl = payload.audioUrl ?? st.audioUrl ?? null;

    if (sameVersion) {
      set({
        isOpen: true,
        playToken: nextToken,
        pendingSeekRatio: r,
        title: mergedTitle,
        subtitle: mergedSubtitle,
        collabBadges: mergedCollabBadges,
        artistId: mergedArtistId,
        artistSlug: mergedArtistSlug,
        coverUrl: mergedCoverUrl,
        projectId: mergedProjectId,
      });

      if (!st.isPlaying) {
        set({ playRequestId: st.playRequestId + 1 });
      } else {
        queueMicrotask(() => get().applyPendingSeekIfPossible());
      }

      return;
    }

    set({
      isOpen: true,
      isPlaying: false,
      projectId: mergedProjectId,
      versionId: payload.versionId,
      title: mergedTitle,
      subtitle: mergedSubtitle,
      collabBadges: mergedCollabBadges,
      artistId: mergedArtistId,
      artistSlug: mergedArtistSlug,
      audioUrl: mergedAudioUrl,
      coverUrl: mergedCoverUrl,
      duration: safePositive(payload.duration),
      currentTime: 0,
      pendingSeekRatio: r,
      playRequestId: st.playRequestId + 1,
      lastLoadedVersionId: null,
      playToken: nextToken,
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
      collabBadges: null,
      audioUrl: null,
      coverUrl: null,
      duration: 0,
      currentTime: 0,
      pendingSeekRatio: null,
      lastLoadedVersionId: null,
      playToken: 0,
      artistId: null,
      artistSlug: null,
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
