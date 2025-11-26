import { SupabaseClient } from "@supabase/supabase-js";
import type {
  ArtistInsert,
  ArtistSignupMetadata,
  UsersProfileInsert,
} from "@/types/supabase";

type ServerSupabase = SupabaseClient<any, any, any>;

function clean(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildProfile(userId: string, meta: ArtistSignupMetadata): UsersProfileInsert {
  const photo =
    clean(meta.artist_photo_url) || clean(meta.artist_image_url) || null;

  return {
    id: userId,
    user_id: userId,
    artist_name: clean(meta.artist_name),
    artist_genre: clean(meta.artist_genre),
    artist_photo_url: photo,
    artist_link_source: clean(meta.artist_link_source),
    spotify_id: clean(meta.spotify_id),
    spotify_url: clean(meta.spotify_url),
    instagram_url: clean(meta.instagram_url),
    beatport_url: clean(meta.beatport_url),
    traxsource_url: clean(meta.traxsource_url),
    soundcloud_url: clean(meta.soundcloud_url),
    songstats_url: clean(meta.songstats_url),
    beatstats_url: clean(meta.beatstats_url),
    resident_advisor_url: clean(meta.resident_advisor_url),
    songkick_url: clean(meta.songkick_url),
    apple_music_url: clean(meta.apple_music_url),
    tidal_url: clean(meta.tidal_url),
    basic_completed: null,
  };
}

function buildArtist(userId: string, meta: ArtistSignupMetadata): ArtistInsert {
  const photo =
    clean(meta.artist_photo_url) || clean(meta.artist_image_url) || null;

  return {
    id: userId,
    user_id: userId,
    artist_name: clean(meta.artist_name),
    artist_genre: clean(meta.artist_genre),
    artist_photo_url: photo,
    artist_link_source: clean(meta.artist_link_source),
    spotify_id: clean(meta.spotify_id),
    spotify_url: clean(meta.spotify_url),
    instagram_url: clean(meta.instagram_url),
    beatport_url: clean(meta.beatport_url),
    beatstats_url: clean(meta.beatstats_url),
    traxsource_url: clean(meta.traxsource_url),
    soundcloud_url: clean(meta.soundcloud_url),
    songstats_url: clean(meta.songstats_url),
    resident_advisor_url: clean(meta.resident_advisor_url),
    songkick_url: clean(meta.songkick_url),
    apple_music_url: clean(meta.apple_music_url),
    tidal_url: clean(meta.tidal_url),
  };
}

export async function ensureProfileAndArtist(opts: {
  supabase: ServerSupabase;
  userId: string;
  metadata: ArtistSignupMetadata;
}) {
  const { supabase, userId, metadata } = opts;

  const profilePayload = buildProfile(userId, metadata);
  const { error: profileErr } = await supabase
    .from("users_profile")
    .upsert(profilePayload, { onConflict: "id" });

  if (profileErr) {
    throw profileErr;
  }

  const artistPayload = buildArtist(userId, metadata);
  const { error: artistErr } = await supabase
    .from("artists")
    .upsert(artistPayload, { onConflict: "id" });

  if (artistErr) {
    throw artistErr;
  }
}
