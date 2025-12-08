// app/api/circuit/artists/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const searchParams = req.nextUrl.searchParams;
    const genre = searchParams.get("genre");
    const collab = searchParams.get("collab");
    const promo = searchParams.get("promo");

let query = supabase
  .from("users_profile")
  .select(
    "id, artist_name, main_genres, city, country, open_to_collab, open_to_promo"
  );
      // se hai un flag is_public:
      // .eq("is_public", true)

if (genre) {
  // main_genres @> [genre]
  query = query.contains("main_genres", [genre]);
}

    if (collab === "true") {
      query = query.eq("open_to_collab", true);
    }

    if (promo === "true") {
      query = query.eq("open_to_promo", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[circuit][artists] error", error);
      return NextResponse.json(
        { error: "Errore caricando gli artisti Circuit" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (err) {
    console.error("[circuit][artists] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
