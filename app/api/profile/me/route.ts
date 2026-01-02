// app/api/profile/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdmin } from "@/app/api/artist/profile";
import type { AdminSupabaseClient } from "@/types/supabase";

function extractSpotifyId(url?: string | null): string | null {
  if (!url) return null;
  try {
    const normalized = url.split("?")[0];
    const match = normalized.match(/artist\/([0-9A-Za-z]+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function ensureArtistSync(
  admin: AdminSupabaseClient,
  userId: string,
  spotifyUrl: string | null
) {
  await admin
    .from("artist_sync_queue")
    .upsert(
      {
        artist_id: userId,
        status: "pending",
        next_run_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "artist_id" }
    );

  if (spotifyUrl) {
    await admin
      .from("artists")
      .update({
        spotify_url: spotifyUrl,
        spotify_id: extractSpotifyId(spotifyUrl),
      })
      .eq("user_id", userId)
      .limit(1);
  }
}

export const runtime = "nodejs";

const PROFILE_COLUMNS = `
  id,
  artist_name,
  main_genres,
  city,
  country,
  bio_short,
  open_to_collab,
  open_to_promo,
  photo_url,
  spotify_url,
  instagram_url,
  soundcloud_url,
  beatport_url,
  beatstats_url,
  apple_music_url
`;

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[GET /api/profile/me] auth error:", authError);
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    const defaultProfile = {
      id: user.id,
      auth_user_id: user.id,
      artist_name: null,
      main_genres: [],
      city: null,
      country: null,
      bio_short: null,
      open_to_collab: true,
      open_to_promo: true,
      photo_url: null,
      spotify_url: null,
      instagram_url: null,
      soundcloud_url: null,
      beatport_url: null,
      beatstats_url: null,
      apple_music_url: null,
    };

    const { data, error } = await supabase
      .from("users_profile")
      .select(PROFILE_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/profile/me] supabase error:", error);
      return NextResponse.json(
        {
          error: "Errore caricando il profilo.",
          detail: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? defaultProfile, { status: 200 });
  } catch (err: any) {
    console.error("[GET /api/profile/me] unexpected error:", err);
    return NextResponse.json(
      { error: "Errore inatteso caricando il profilo." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[PUT /api/profile/me] auth error:", authError);
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      artist_name,
      main_genres,
      city,
      country,
      bio_short,
      open_to_collab,
      open_to_promo,
      photo_url,
      spotify_url,
      instagram_url,
      soundcloud_url,
      beatport_url,
      beatstats_url,
      apple_music_url,
    } = body;

    const normalizeString = (v: unknown) =>
      typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

    const normalizeStringArray = (v: unknown) =>
      Array.isArray(v) && v.length > 0 ? v : null;

    const normalizeBoolean = (v: unknown, fallback: boolean) =>
      typeof v === "boolean" ? v : fallback;

    const updatePayload: Record<string, any> = {
      artist_name: normalizeString(artist_name),
      main_genres: normalizeStringArray(main_genres),
      city: normalizeString(city),
      country: normalizeString(country),
      bio_short: normalizeString(bio_short),
      open_to_collab: normalizeBoolean(open_to_collab, true),
      open_to_promo: normalizeBoolean(open_to_promo, true),

      // qui usiamo photo_url (colonna reale), NON artist_photo_url
      photo_url: normalizeString(photo_url),

      spotify_url: normalizeString(spotify_url),
      instagram_url: normalizeString(instagram_url),
      soundcloud_url: normalizeString(soundcloud_url),
      beatport_url: normalizeString(beatport_url),
      beatstats_url: normalizeString(beatstats_url),
      apple_music_url: normalizeString(apple_music_url),
    };

    const {
      data: updated,
      error: updateError,
    } = await supabase
      .from("users_profile")
      .update(updatePayload)
      .eq("user_id", user.id)
      .select(PROFILE_COLUMNS)
      .maybeSingle();

    if (updateError) {
      console.error("[PUT /api/profile/me] supabase error:", updateError);
      return NextResponse.json(
        {
          error: "Errore salvando il profilo.",
          detail: updateError.message,
          code: updateError.code,
        },
        { status: 500 }
      );
    }

    const admin = getSupabaseAdmin();

  if (updated) {
    await ensureArtistSync(admin, user.id, updatePayload.spotify_url);
    if (updatePayload.artist_name) {
      await admin
        .from("artists")
        .update({
          artist_name: updatePayload.artist_name,
          is_public: true,
        })
        .eq("user_id", user.id)
        .limit(1);
    }
    return NextResponse.json(updated, { status: 200 });
  }

    const { data: inserted, error: insertError } = await admin
      .from("users_profile")
      .upsert(
        {
          ...updatePayload,
          id: user.id,
          user_id: user.id,
          auth_user_id: user.id,
        },
        { onConflict: "id" }
      )
      .select(PROFILE_COLUMNS)
      .single();

    if (insertError) {
      console.error(
        "[PUT /api/profile/me] admin supabase error:",
        insertError
      );
      return NextResponse.json(
        {
          error: "Errore salvando il profilo.",
          detail: insertError.message,
          code: insertError.code,
        },
        { status: 500 }
      );
    }

  await ensureArtistSync(admin, user.id, updatePayload.spotify_url);
  if (updatePayload.artist_name) {
    await admin
      .from("artists")
      .update({
        artist_name: updatePayload.artist_name,
        is_public: true,
      })
      .eq("user_id", user.id)
      .limit(1);
  }
  return NextResponse.json(inserted, { status: 200 });
  } catch (err: any) {
    console.error("[PUT /api/profile/me] unexpected error:", err);
    return NextResponse.json(
      { error: "Errore inatteso salvando il profilo." },
      { status: 500 }
    );
  }
}
