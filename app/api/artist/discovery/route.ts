import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("users_profile")
      .select(
        `
        id,
        artist_name,
        avatar_url,
        photo_url,
        main_genres,
        bio_short,
        city,
        country,
        open_to_collab,
        spotify_url,
        instagram_username,
        beatport_url,
        role,
        created_at
      `
      )
      .eq("role", "artist")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/artist/discovery] supabase error:", error);
      return NextResponse.json(
        { error: "Errore caricando la lista artisti" },
        { status: 500 }
      );
    }

    const artists =
      data?.map((row) => ({
        id: row.id,
        artist_name: row.artist_name ?? "Tekkin Artist",
        artist_photo_url: row.avatar_url ?? row.photo_url ?? null,
        main_genres: Array.isArray(row.main_genres)
          ? row.main_genres.filter(Boolean)
          : row.main_genres
          ? [row.main_genres]
          : [],
        bio_short: row.bio_short ?? null,
        city: row.city ?? null,
        country: row.country ?? null,
        open_to_collab: Boolean(row.open_to_collab),
        spotify_url: row.spotify_url ?? null,
        instagram_username: row.instagram_username ?? null,
        beatport_url: row.beatport_url ?? null,
      })) ?? [];

    return NextResponse.json({ artists });
  } catch (err) {
    console.error("[GET /api/artist/discovery] unexpected error:", err);
    return NextResponse.json(
      { error: "Errore caricando la lista artisti" },
      { status: 500 }
    );
  }
}
