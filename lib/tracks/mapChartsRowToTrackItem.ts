import type { TrackCollabBadge, TrackItem, TrackVisibility } from "@/lib/tracks/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function mapChartsAnyToTrackItem(x: unknown): TrackItem | null {
  const record = isRecord(x) ? x : {};
  const versionId =
    typeof record.version_id === "string"
      ? record.version_id
      : typeof record.versionId === "string"
      ? record.versionId
      : null;

  const audioUrl =
    typeof record.audio_url === "string"
      ? record.audio_url
      : typeof record.audioUrl === "string"
      ? record.audioUrl
      : null;

  if (!versionId || !audioUrl) return null;

  const visibility: TrackVisibility =
    record.visibility === "public"
      ? "public"
      : record.visibility === "private_with_secret_link"
      ? "private_with_secret_link"
      : "private";

  return {
    versionId,
    audioUrl,

    title:
      typeof record.track_title === "string" && record.track_title.trim()
        ? record.track_title
        : typeof record.title === "string" && record.title.trim()
        ? record.title
        : "Untitled",

    artistName:
      typeof record.artist_name === "string"
        ? record.artist_name
        : typeof record.artistName === "string"
        ? record.artistName
        : null,

    coverUrl:
      typeof record.cover_url === "string"
        ? record.cover_url
        : typeof record.coverUrl === "string"
        ? record.coverUrl
        : null,
    artistId:
      typeof record.artist_id === "string"
        ? record.artist_id
        : typeof record.artistId === "string"
        ? record.artistId
        : null,

    artistSlug:
      typeof record.artist_slug === "string"
        ? record.artist_slug
        : typeof record.artistSlug === "string"
        ? record.artistSlug
        : null,
    collabBadges:
      Array.isArray(record.collab_badges)
        ? (record.collab_badges as TrackCollabBadge[])
        : Array.isArray(record.collabBadges)
        ? (record.collabBadges as TrackCollabBadge[])
        : null,

    mixType:
      record.mix_type === "premaster" || record.mix_type === "master"
        ? record.mix_type
        : record.mixType === "premaster" || record.mixType === "master"
        ? record.mixType
        : null,

    scorePublic:
      typeof record.score_public === "number"
        ? record.score_public
        : typeof record.scorePublic === "number"
        ? record.scorePublic
        : null,

    plays: typeof record.plays === "number" ? record.plays : null,

    visibility,

    likesCount:
      typeof record.likes_count === "number"
        ? record.likes_count
        : typeof record.likesCount === "number"
        ? record.likesCount
        : typeof record.likes === "number"
        ? record.likes
        : 0,

    likedByMe:
      typeof record.liked_by_me === "boolean"
        ? record.liked_by_me
        : typeof record.likedByMe === "boolean"
        ? record.likedByMe
        : Boolean(record.liked),
  };
}
