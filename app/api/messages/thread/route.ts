import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type {
  ArtistMessageThread,
  ArtistMessage,
  PeerProfile,
} from "@/types/messages";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      console.error("[GET /api/messages/thread] auth error", userErr);
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

    const otherUserId = req.nextUrl.searchParams.get("with");
    if (!otherUserId) {
      return NextResponse.json(
        { error: "Parametro 'with' mancante" },
        { status: 400 }
      );
    }

    // 1) trova thread esistente tra user.id e otherUserId
    const { data: existingThread, error: threadErr } = await supabase
      .from("artist_message_threads")
      .select("*")
      .or(
        `and(user_a_id.eq.${user.id},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${user.id})`
      )
      .maybeSingle<ArtistMessageThread>();

    if (threadErr) {
      console.error("[GET /api/messages/thread] select thread error", threadErr);
      return NextResponse.json(
        { error: "Errore caricando il thread" },
        { status: 500 }
      );
    }

    let thread: ArtistMessageThread | null = existingThread ?? null;

    // 2) se non esiste, crealo
    if (!thread) {
      const { data: created, error: createErr } = await supabase
        .from("artist_message_threads")
        .insert([
          {
            user_a_id: user.id,
            user_b_id: otherUserId,
          },
        ])
        .select("*")
        .single<ArtistMessageThread>();

      if (createErr) {
        console.error(
          "[GET /api/messages/thread] create thread error",
          createErr
        );
        return NextResponse.json(
          { error: "Errore creando il thread" },
          { status: 500 }
        );
      }

      thread = created;
    }

    // 3) carica messaggi del thread
    const { data: messages, error: msgErr } = await supabase
      .from("artist_messages")
      .select("*")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    if (msgErr) {
      console.error("[GET /api/messages/thread] messages error", msgErr);
    }

    // 4) profilo dell’altro artista (users_profile)
    const peerId =
      thread.user_a_id === user.id ? thread.user_b_id : thread.user_a_id;

    const { data: peerProfileRow, error: peerErr } = await supabase
      .from("users_profile")
      .select("id, artist_name, avatar_url")
      .eq("id", peerId)
      .maybeSingle<PeerProfile>();

    if (peerErr) {
      console.error("[GET /api/messages/thread] peer profile error", peerErr);
    }

    const payload = {
      thread,
      messages: (messages ?? []) as ArtistMessage[],
      peerProfile: peerProfileRow ?? null,
      me: {
        id: user.id,
      },
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[GET /api/messages/thread] unexpected error", err);
    return NextResponse.json(
      { error: "Errore caricando il thread" },
      { status: 500 }
    );
  }
}
