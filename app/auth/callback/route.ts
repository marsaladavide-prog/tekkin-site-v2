import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { syncArtistTablesFromMetadata } from "@/app/api/artist/profile";
import type { ArtistSignupMetadata } from "@/types/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  try {
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    const code = url.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(new URL("/login?e=oauth", url.origin));
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login?e=no_user", url.origin));
    }

    const meta = (user.user_metadata ?? {}) as ArtistSignupMetadata;

    await syncArtistTablesFromMetadata({
      userId: user.id,
      metadata: {
        artist_name: meta.artist_name ?? null,
        artist_photo_url: meta.artist_photo_url ?? null,
        artist_image_url: meta.artist_image_url ?? null,
        artist_link_source: meta.artist_link_source ?? null,
        spotify_url: meta.spotify_url ?? null,
        instagram_url: meta.instagram_url ?? null,
        soundcloud_url: meta.soundcloud_url ?? null,
        beatport_url: meta.beatport_url ?? null,
        beatstats_url: meta.beatstats_url ?? null,
        artist_genre: meta.artist_genre ?? null,
      },
    });

    const response = NextResponse.redirect(new URL("/artist/projects", url.origin));
    const supabaseCookiePattern = /^sb/;
    cookieStore.getAll().forEach((cookie) => {
      if (!supabaseCookiePattern.test(cookie.name)) return;
      response.cookies.set(cookie.name, cookie.value);
    });
    return response;
  } catch (err) {
    console.error("[auth/callback] unexpected", err);
    return NextResponse.redirect(new URL("/login?e=callback", url.origin));
  }
}
