import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { ArtistMessage } from "@/types/messages";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      console.error("[POST /api/messages] auth error", userErr);
      return NextResponse.json(
        { error: "Errore autenticazione" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const threadId: string | undefined = body.thread_id;
    const text: string | undefined = body.body;

    if (!threadId || !text || !text.trim()) {
      return NextResponse.json(
        { error: "thread_id o body mancanti" },
        { status: 400 }
      );
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("artist_messages")
      .insert([
        {
          thread_id: threadId,
          sender_id: user.id,
          body: text.trim(),
        },
      ])
      .select("*")
      .single<ArtistMessage>();

    if (insertErr) {
      console.error("[POST /api/messages] insert error", insertErr);
      return NextResponse.json(
        { error: "Errore inviando il messaggio" },
        { status: 500 }
      );
    }

    return NextResponse.json(inserted);
  } catch (err) {
    console.error("[POST /api/messages] unexpected error", err);
    return NextResponse.json(
      { error: "Errore inviando il messaggio" },
      { status: 500 }
    );
  }
}
