import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

interface Params {
  params: { artistId: string }; // occhio al nome cartella [artistId]
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const artistId = params.artistId;

    const { data, error } = await supabase
      .from("users_profile")
      .select(
        `
        id,
        artist_name,
        main_genres,
        city,
        country,
        bio_short,
        open_to_collab,
        open_to_promo,
        spotify_url,
        spotify_followers,
        spotify_popularity
        `
      )
      .eq("id", artistId)
      .single();

    if (error || !data) {
      console.error("[circuit][artist-detail] error", error);
      return NextResponse.json(
        { error: "Artista non trovato" },
        { status: 404 }
      );
    }

    const mainGenres = (data as any).main_genres as string[] | null;

    const response = {
      ...data,
      main_genre: mainGenres && mainGenres.length > 0 ? mainGenres[0] : null,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("[circuit][artist-detail] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
