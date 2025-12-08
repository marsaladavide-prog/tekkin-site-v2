// app/api/profile/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

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
        open_to_promo
      `
      )
      .eq("user_id", user.id)
      .single();

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

    return NextResponse.json(data, { status: 200 });
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
    } = body;

    const updatePayload: Record<string, any> = {
      artist_name: artist_name ?? null,
      main_genres: Array.isArray(main_genres) ? main_genres : null,
      city: city ?? null,
      country: country ?? null,
      bio_short: bio_short ?? null,
      open_to_collab:
        typeof open_to_collab === "boolean" ? open_to_collab : true,
      open_to_promo:
        typeof open_to_promo === "boolean" ? open_to_promo : true,
    };

    const { error: updateError } = await supabase
      .from("users_profile")
      .update(updatePayload)
      .eq("user_id", user.id);

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

    const { data: updated, error: selectError } = await supabase
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
        open_to_promo
      `
      )
      .eq("user_id", user.id)
      .single();

    if (selectError) {
      console.error(
        "[PUT /api/profile/me] select after update error:",
        selectError
      );
      return NextResponse.json(
        {
          error:
            "Profilo aggiornato ma errore rileggendo i dati.",
          detail: selectError.message,
          code: selectError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (err: any) {
    console.error("[PUT /api/profile/me] unexpected error:", err);
    return NextResponse.json(
      { error: "Errore inatteso salvando il profilo." },
      { status: 500 }
    );
  }
}
