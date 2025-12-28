// app/api/discovery/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get("project_id")?.trim() || null;
    if (!projectId) {
      return NextResponse.json({ error: "project_id mancante" }, { status: 400 });
    }

    // sicurezza: il project deve essere tuo
    const { data: projectRow, error: projErr } = await supabase
      .from("projects")
      .select("id, user_id, title")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr || !projectRow) {
      return NextResponse.json({ error: "Project non trovato" }, { status: 404 });
    }
    if (projectRow.user_id !== user.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const { data: reqs, error: reqErr } = await supabase
      .from("discovery_requests")
      .select("id, kind, project_id, sender_id, receiver_id, message, status, created_at, updated_at, revealed_at")
      .eq("project_id", projectId)
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false });

    if (reqErr) {
      console.error("[discovery][report] reqErr", reqErr);
      return NextResponse.json({ error: "Errore caricando il report" }, { status: 500 });
    }

    const receiverIds = [...new Set((reqs ?? []).map((r) => r.receiver_id).filter(Boolean))];

    const { data: receivers, error: recErr } = await supabase
      .from("users_profile")
      .select("id, artist_name, avatar_url")
      .in("id", receiverIds);

    if (recErr) {
      console.error("[discovery][report] recErr", recErr);
    }

    const receiverMap = new Map((receivers ?? []).map((r) => [r.id, r]));

    const out = (reqs ?? []).map((r) => {
      const receiver = receiverMap.get(r.receiver_id);
      return {
        request_id: r.id,
        kind: r.kind,
        project_id: r.project_id,
        project_title: projectRow.title ?? "Project",
        message: r.message ?? null,
        status: r.status ?? "pending",
        created_at: r.created_at ?? null,
        updated_at: r.updated_at ?? null,
        revealed_at: r.revealed_at ?? null,
        receiver: receiver
          ? { id: receiver.id, artist_name: receiver.artist_name ?? null, avatar_url: receiver.avatar_url ?? null }
          : { id: r.receiver_id, artist_name: null, avatar_url: null },
      };
    });

    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    console.error("[discovery][report] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
