export type TrackVisibility = "public" | "private_with_secret_link" | "private";

export type TrackItem = {
  versionId: string;
  title: string;
  artistName: string | null;
  coverUrl: string | null;
  audioUrl: string;

  mixType?: "premaster" | "master" | null;

  // charts / ranking
  scorePublic?: number | null;
  plays?: number | null;
  visibility?: TrackVisibility;

  // likes
  likesCount: number;
  likedByMe: boolean;
};
