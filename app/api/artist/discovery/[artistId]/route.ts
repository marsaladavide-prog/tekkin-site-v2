import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ artistId: string }> }
) {
  try {
    const { artistId } = await ctx.params;

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
        open_to_collab
      `
      )
      .eq("id", artistId)
      .maybeSingle();

    if (error) {
      console.error("[GET /artist/discovery/:id] supabase error:", error);
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

    // Mappo ai campi che usa il frontend
    const artist = {
      id: data.id,
      artist_name: data.artist_name,
      artist_photo_url: data.avatar_url ?? data.photo_url ?? null,
      bio_short: data.bio_short,
      city: data.city,
      country: data.country,
      open_to_collab: data.open_to_collab,
      main_genres: Array.isArray(data.main_genres)
        ? data.main_genres
        : data.main_genres
        ? [data.main_genres]
        : [],
    };

    return NextResponse.json({ artist });
  } catch (err) {
    console.error("[GET /artist/discovery/:id] unexpected:", err);
    return NextResponse.json(
      { error: "Errore inatteso caricando l'artista" },
      { status: 500 }
    );
  }
}
