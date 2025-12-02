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

    const { receiver_id, project_id, kind, message } = body;

    if (!receiver_id || !project_id || !kind) {
      return NextResponse.json(
        { error: "receiver_id, project_id e kind sono obbligatori" },
        { status: 400 }
      );
    }

    if (kind !== "collab" && kind !== "promo") {
      return NextResponse.json(
        { error: "kind deve essere 'collab' o 'promo'" },
        { status: 400 }
      );
    }

    const { data: insertData, error: insertError } = await supabase
      .from("discovery_requests")
      .insert({
        sender_id: user.id,
        receiver_id,
        project_id,
        kind,
        message: message ?? null,
        is_anonymous: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[discovery][request] insertError", insertError);
      return NextResponse.json(
        { error: "Errore creando la richiesta" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: insertData.id,
        status: insertData.status,
        kind: insertData.kind,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[discovery][request] unexpected", err);
    return NextResponse.json(
      { error: "Errore inatteso" },
      { status: 500 }
    );
  }
}
