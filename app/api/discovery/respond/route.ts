import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type Body = {
  request_id?: string;
  action?: "accept" | "reject";
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data, error: authError } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    if (authError || !user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) {
      return NextResponse.json({ error: "Body mancante" }, { status: 400 });
    }

    const requestId = body.request_id?.trim();
    const action = body.action;

    if (!requestId || (action !== "accept" && action !== "reject")) {
      return NextResponse.json(
        { error: "request_id e action validi sono obbligatori" },
        { status: 400 }
      );
    }

    const patch =
      action === "reject"
        ? { status: "rejected", updated_at: new Date().toISOString() }
        : {
            status: "accepted",
            revealed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

    const { data: updated, error: updateError } = await supabase
      .from("discovery_requests")
      .update(patch)
      .eq("id", requestId)
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .select("id, kind, sender_id, status, revealed_at")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Richiesta non trovata o già gestita" },
        { status: 400 }
      );
    }

    if (action === "reject") {
      return NextResponse.json({ status: "rejected" }, { status: 200 });
    }

    // accept: prendo info base del sender
    const { data: senderProfile, error: profileError } = await supabase
      .from("users_profile")
      .select("id, artist_name, avatar_url")
      .eq("id", updated.sender_id)
      .single();

    if (profileError) {
      // Non bloccare la risposta: riveliamo almeno l'id
      return NextResponse.json(
        {
          status: "accepted",
          kind: updated.kind,
          sender: { id: updated.sender_id },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        status: "accepted",
        kind: updated.kind,
        sender: {
          id: senderProfile.id,
          artist_name: senderProfile.artist_name ?? null,
          avatar_url: senderProfile.avatar_url ?? null,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[discovery][respond] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
