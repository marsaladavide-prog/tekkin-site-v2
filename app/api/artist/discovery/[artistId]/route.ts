import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const { artistId } = await params;

  if (!artistId || typeof artistId !== "string") {
    return NextResponse.json(
      { error: "ID artista non valido" },
      { status: 400 }
    );
  }

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
      presskit_link
    `
    )
    .eq("id", artistId)
    .maybeSingle();

  if (error) {
    console.error("[artist/discovery/:id] supabase error", error);
    return NextResponse.json(
      { error: "Errore caricando l'artista" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Artista non trovato" },
      { status: 404 }
    );
  }

  const artist = {
    id: data.id,
    artist_name: data.artist_name,
    artist_photo_url: data.avatar_url ?? data.photo_url ?? null,
    main_genres: Array.isArray(data.main_genres)
      ? data.main_genres
      : data.main_genres
      ? [data.main_genres]
      : [],
    bio_short: data.bio_short,
    city: data.city,
    country: data.country,
    open_to_collab: data.open_to_collab ?? false,
    spotify_url: data.spotify_url ?? null,
    instagram_username: data.instagram_username ?? null,
    beatport_url: data.beatport_url ?? null,
    presskit_link: data.presskit_link ?? null,
  };

  return NextResponse.json({ artist });
}
