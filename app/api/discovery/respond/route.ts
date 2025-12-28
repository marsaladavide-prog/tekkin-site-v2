// app/api/discovery/respond/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { notify } from "@/lib/notifications/notify";

export const runtime = "nodejs";

type Action = "accept" | "reject";

function isAction(v: unknown): v is Action {
  return v === "accept" || v === "reject";
}

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
    const requestId = typeof body?.request_id === "string" ? body.request_id.trim() : "";
    const action = body?.action;

    if (!requestId || !isAction(action)) {
      return NextResponse.json({ error: "Parametri non validi" }, { status: 400 });
    }

    // 1) leggo la richiesta
    const { data: row, error: readErr } = await supabase
      .from("discovery_requests")
      .select("id, kind, project_id, sender_id, receiver_id, status, created_at, updated_at, revealed_at")
      .eq("id", requestId)
      .maybeSingle();

    if (readErr) {
      console.error("[discovery][respond] readErr", readErr);
      return NextResponse.json({ error: "Errore caricando la richiesta" }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
    }

    // 2) solo il receiver può rispondere
    if (row.receiver_id !== user.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    // 3) idempotenza: se già gestita, NON è un errore
    if (row.status && row.status !== "pending") {
      return NextResponse.json(
        {
          ok: true,
          already: true,
          request_id: row.id,
          status: row.status,
          kind: row.kind,
          project_id: row.project_id,
        },
        { status: 200 }
      );
    }

    const nextStatus = action === "accept" ? "accepted" : "rejected";
    const nowIso = new Date().toISOString();
    const revealedAt = action === "accept" ? nowIso : null;

    // 4) update safe: aggiorno solo se ancora pending (race-safe)
    const { data: updated, error: updErr } = await supabase
      .from("discovery_requests")
      .update({ status: nextStatus, revealed_at: revealedAt })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id, kind, project_id, sender_id, receiver_id, status, revealed_at")
      .maybeSingle();

    if (updErr) {
      console.error("[discovery][respond] updErr", updErr);
      return NextResponse.json({ error: "Errore aggiornando la richiesta" }, { status: 500 });
    }

    // se qualcuno l’ha già gestita tra read e update, torno 200 idempotente
    if (!updated) {
      const { data: reRead, error: reReadErr } = await supabase
        .from("discovery_requests")
        .select("id, kind, project_id, sender_id, receiver_id, status, revealed_at")
        .eq("id", requestId)
        .maybeSingle();

      if (reReadErr) {
        console.error("[discovery][respond] reReadErr", reReadErr);
        return NextResponse.json({ error: "Errore verificando stato richiesta" }, { status: 500 });
      }

      if (!reRead) {
        return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
      }

      return NextResponse.json(
        {
          ok: true,
          already: true,
          request_id: reRead.id,
          status: reRead.status,
          kind: reRead.kind,
          project_id: reRead.project_id,
        },
        { status: 200 }
      );
    }

    // 5) se accept, posso rivelare il sender profile
    let sender: { id: string; artist_name: string | null; avatar_url: string | null } | null = null;

    if (action === "accept") {
      const { data: sp, error: spErr } = await supabase
        .from("users_profile")
        .select("id, artist_name, avatar_url")
        .eq("id", updated.sender_id)
        .maybeSingle();

      if (spErr) {
        console.error("[discovery][respond] senderProfileErr", spErr);
      } else if (sp) {
        sender = { id: sp.id, artist_name: sp.artist_name ?? null, avatar_url: sp.avatar_url ?? null };
      }
    }

    // Notifica con notify
    await notify({
      userId: updated.sender_id,
      type: updated.status === "accepted" ? "signal_accepted" : "signal_rejected",
      title: updated.status === "accepted" ? "Signal accettato" : "Signal rifiutato",
      body: updated.status === "accepted"
        ? "Il tuo Signal è stato accettato."
        : "Il tuo Signal è stato rifiutato.",
      href: `/artist/projects/signal-report?project_id=${encodeURIComponent(updated.project_id)}`,
      data: { request_id: updated.id, project_id: updated.project_id, status: updated.status },
    });

    return NextResponse.json(
      {
        ok: true,
        already: false,
        request_id: updated.id,
        status: updated.status,
        kind: updated.kind,
        project_id: updated.project_id,
        sender,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[discovery][respond] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
