import type { TrackItem, TrackVisibility } from "@/lib/tracks/types";

export function mapChartsAnyToTrackItem(x: any): TrackItem | null {
  const versionId =
    typeof x?.version_id === "string"
      ? x.version_id
      : typeof x?.versionId === "string"
      ? x.versionId
      : null;

  const audioUrl =
    typeof x?.audio_url === "string"
      ? x.audio_url
      : typeof x?.audioUrl === "string"
      ? x.audioUrl
      : null;

  if (!versionId || !audioUrl) return null;

  const visibility: TrackVisibility =
    x?.visibility === "public"
      ? "public"
      : x?.visibility === "private_with_secret_link"
      ? "private_with_secret_link"
      : "private";

  return {
    versionId,
    audioUrl,

    title:
      typeof x?.track_title === "string" && x.track_title.trim()
        ? x.track_title
        : typeof x?.title === "string" && x.title.trim()
        ? x.title
        : "Untitled",

    artistName:
      typeof x?.artist_name === "string"
        ? x.artist_name
        : typeof x?.artistName === "string"
        ? x.artistName
        : null,

    coverUrl:
      typeof x?.cover_url === "string"
        ? x.cover_url
        : typeof x?.coverUrl === "string"
        ? x.coverUrl
        : null,

    mixType:
      x?.mix_type === "premaster" || x?.mix_type === "master"
        ? x.mix_type
        : x?.mixType === "premaster" || x?.mixType === "master"
        ? x.mixType
        : null,

    scorePublic:
      typeof x?.score_public === "number"
        ? x.score_public
        : typeof x?.scorePublic === "number"
        ? x.scorePublic
        : null,

    plays: typeof x?.plays === "number" ? x.plays : null,

    visibility,

    likesCount:
      typeof x?.likes_count === "number"
        ? x.likes_count
        : typeof x?.likesCount === "number"
        ? x.likesCount
        : typeof x?.likes === "number"
        ? x.likes
        : 0,

    likedByMe:
      typeof x?.liked_by_me === "boolean"
        ? x.liked_by_me
        : typeof x?.likedByMe === "boolean"
        ? x.likedByMe
        : Boolean(x?.liked),
  };
}
