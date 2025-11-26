import { createClient } from "@supabase/supabase-js";
import type {
  AdminSupabaseClient,
  ArtistInsert,
  ArtistSignupMetadata,
  Database,
  UsersProfileInsert,
} from "@/types/supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sanitize(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getSupabaseAdmin(): AdminSupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role non configurato");
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function buildProfilePayload(
  userId: string,
  metadata: ArtistSignupMetadata
): UsersProfileInsert {
  const photo =
    sanitize(metadata.artist_photo_url) ||
    sanitize(metadata.artist_image_url) ||
    null;

  return {
    id: userId,
    artist_name: sanitize(metadata.artist_name),
    artist_genre: sanitize(metadata.artist_genre),
    artist_photo_url: photo,
    artist_link_source: sanitize(metadata.artist_link_source),
    spotify_id: sanitize(metadata.spotify_id),
    spotify_url: sanitize(metadata.spotify_url),
    instagram_url: sanitize(metadata.instagram_url),
    beatport_url: sanitize(metadata.beatport_url),
    traxsource_url: sanitize(metadata.traxsource_url),
    soundcloud_url: sanitize(metadata.soundcloud_url),
    songstats_url: sanitize(metadata.songstats_url),
    beatstats_url: sanitize(metadata.beatstats_url),
    resident_advisor_url: sanitize(metadata.resident_advisor_url),
    songkick_url: sanitize(metadata.songkick_url),
    apple_music_url: sanitize(metadata.apple_music_url),
    tidal_url: sanitize(metadata.tidal_url),
  };
}

export function buildArtistPayload(
  artistId: string,
  metadata: ArtistSignupMetadata
): ArtistInsert {
  const photo =
    sanitize(metadata.artist_photo_url) ||
    sanitize(metadata.artist_image_url) ||
    null;

  return {
    id: artistId,
    artist_name: sanitize(metadata.artist_name),
    artist_genre: sanitize(metadata.artist_genre),
    artist_photo_url: photo,
    artist_link_source: sanitize(metadata.artist_link_source),
    spotify_id: sanitize(metadata.spotify_id),
    spotify_url: sanitize(metadata.spotify_url),
    instagram_url: sanitize(metadata.instagram_url),
    beatport_url: sanitize(metadata.beatport_url),
    beatstats_url: sanitize(metadata.beatstats_url),
    traxsource_url: sanitize(metadata.traxsource_url),
    soundcloud_url: sanitize(metadata.soundcloud_url),
    songstats_url: sanitize(metadata.songstats_url),
    resident_advisor_url: sanitize(metadata.resident_advisor_url),
    songkick_url: sanitize(metadata.songkick_url),
    apple_music_url: sanitize(metadata.apple_music_url),
    tidal_url: sanitize(metadata.tidal_url),
  };
}

export async function upsertUserProfile(
  supabase: AdminSupabaseClient,
  payload: UsersProfileInsert
) {
  return supabase
    .from("users_profile")
    .upsert(payload, { onConflict: "id" })
    .select("id")
    .single();
}

export async function upsertArtist(
  supabase: AdminSupabaseClient,
  payload: ArtistInsert
) {
  return supabase
    .from("artists")
    .upsert(payload, { onConflict: "id" })
    .select("id")
    .single();
}

/**
 * Crea/aggiorna sia users_profile che artists usando i metadata raccolti in registrazione.
 * Va eseguita lato server (service role) subito dopo la sign up.
 */
export async function syncArtistTablesFromMetadata(opts: {
  supabase?: AdminSupabaseClient;
  userId: string;
  metadata: ArtistSignupMetadata;
}) {
  const supabase = opts.supabase || getSupabaseAdmin();

  const profilePayload = buildProfilePayload(opts.userId, opts.metadata);
  const { error: profileErr, data: profileData } = await upsertUserProfile(
    supabase,
    profilePayload
  );
  if (profileErr) throw profileErr;

  const shouldCreateArtist =
    sanitize(opts.metadata.spotify_id) ||
    sanitize(opts.metadata.spotify_url) ||
    sanitize(opts.metadata.artist_name);

  if (!shouldCreateArtist) {
    return { profileId: profileData?.id ?? opts.userId, artistId: null };
  }

  const artistPayload = buildArtistPayload(opts.userId, opts.metadata);
  const { error: artistErr, data: artistData } = await upsertArtist(
    supabase,
    artistPayload
  );
  if (artistErr) throw artistErr;

  return { profileId: profileData?.id ?? opts.userId, artistId: artistData?.id ?? opts.userId };
}
