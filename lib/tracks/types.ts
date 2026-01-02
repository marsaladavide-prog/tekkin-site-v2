import type { WaveformBands } from "@/types/analyzer";

export type TrackVisibility = "public" | "private_with_secret_link" | "private";

export type TrackCollabBadge = {
  label: string;
  href?: string | null;
};

export type TrackItem = {
  // identity
  versionId: string;
  projectId?: string | null;

  // display
  title: string;
  artistName: string | null;
  coverUrl: string | null;
  artistId?: string | null;
  artistSlug?: string | null;
  collabBadges?: TrackCollabBadge[] | null;

  // audio (in charts può non esserci sempre: se vuoi zero errori, rendilo nullable)
  audioUrl: string | null;
  audioPath?: string | null;
  waveformPeaks?: number[] | null;
  waveformBands?: WaveformBands | null;
  waveformDuration?: number | null;

  // meta
  mixType?: "premaster" | "master" | null;

  // charts / ranking
  scorePublic?: number | null;
  plays?: number | null;
  visibility?: TrackVisibility;

  // likes
  likesCount: number;
  likedByMe: boolean;
};
