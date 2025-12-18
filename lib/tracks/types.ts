export type TrackVisibility = "public" | "private_with_secret_link" | "private";

export type TrackItem = {
  // identity
  versionId: string;

  // display
  title: string;
  artistName: string | null;
  coverUrl: string | null;

  // audio (in charts può non esserci sempre: se vuoi zero errori, rendilo nullable)
  audioUrl: string | null;
  audioPath?: string | null;

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
