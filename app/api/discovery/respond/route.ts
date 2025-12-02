import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Body mancante" }, { status: 400 });
    }

    const { request_id, action } = body;

    if (!request_id || !action) {
      return NextResponse.json(
        { error: "request_id e action sono obbligatori" },
        { status: 400 }
      );
    }

    if (action !== "accept" && action !== "reject") {
      return NextResponse.json(
        { error: "action deve essere 'accept' o 'reject'" },
        { status: 400 }
      );
    }

    const { data: request, error: fetchError } = await supabase
      .from("discovery_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (fetchError || !request) {
      return NextResponse.json(
        { error: "Richiesta non trovata" },
        { status: 404 }
      );
    }

    if (request.receiver_id !== user.id) {
      return NextResponse.json(
        { error: "Non autorizzato su questa richiesta" },
        { status: 403 }
      );
    }

    if (request.status !== "pending") {
      return NextResponse.json(
        { error: "Richiesta già gestita" },
        { status: 400 }
      );
    }

    if (action === "reject") {
      const { error: updateError } = await supabase
        .from("discovery_requests")
        .update({
          status: "rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", request_id);

      if (updateError) {
        console.error("[discovery][respond] reject updateError", updateError);
        return NextResponse.json(
          { error: "Errore aggiornando la richiesta" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { status: "rejected" },
        { status: 200 }
      );
    }

    // accept
    const { data: updated, error: acceptError } = await supabase
      .from("discovery_requests")
      .update({
        status: "accepted",
        revealed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id)
      .select()
      .single();

    if (acceptError || !updated) {
      console.error("[discovery][respond] acceptError", acceptError);
      return NextResponse.json(
        { error: "Errore accettando la richiesta" },
        { status: 500 }
      );
    }

    // prendo info base del sender
    const { data: senderProfile, error: profileError } = await supabase
      .from("users_profile")
      .select("id, artist_name, avatar_url")
      .eq("id", updated.sender_id)
      .single();

    if (profileError) {
      console.error("[discovery][respond] profileError", profileError);
      // anche se il profilo manca, riveliamo comunque l id
    }

    return NextResponse.json(
      {
        status: "accepted",
        kind: updated.kind,
        sender: senderProfile
          ? {
              id: senderProfile.id,
              artist_name: senderProfile.artist_name,
              avatar_url: senderProfile.avatar_url,
            }
          : {
              id: updated.sender_id,
            },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[discovery][respond] unexpected", err);
    return NextResponse.json(
      { error: "Errore inatteso" },
      { status: 500 }
    );
  }
}
