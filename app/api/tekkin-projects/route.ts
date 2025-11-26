import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SUPABASE_OPTIONS = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
};

function requireSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase non configurato");
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, SUPABASE_OPTIONS);
}

export async function GET() {
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, type, status, priority")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ projects: data || [] });
  } catch (err) {
    console.error("tekkin-projects GET error", err);
    return NextResponse.json(
      { error: "Errore fetch progetti" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = requireSupabase();
    const body = await req.json();
    const name = String(body?.name || "").trim();
    const type = body?.type === "client" ? "client" : "artist";
    const priority = Number.isFinite(body?.priority) ? Number(body.priority) : 5;

    if (!name) {
      return NextResponse.json(
        { error: "name richiesto" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        type,
        status: "active",
        priority,
      })
      .select("id, name, type, status, priority")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Insert fallita" },
        { status: 500 }
      );
    }

    return NextResponse.json({ project: data }, { status: 201 });
  } catch (err) {
    console.error("tekkin-projects POST error", err);
    return NextResponse.json(
      { error: "Errore creazione progetto" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = requireSupabase();
    const body = await req.json();
    const id = String(body?.id || body?.projectId || "").trim();

    const updates: Record<string, any> = {};
    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (name) updates.name = name;
    }
    if (body?.type === "artist" || body?.type === "client") {
      updates.type = body.type;
    }
    if (typeof body?.status === "string" && body.status.length > 0) {
      updates.status = body.status;
    }
    if (body?.priority !== undefined) {
      const prio = Number(body.priority);
      updates.priority = Number.isFinite(prio) ? prio : null;
    }

    if (!id) {
      return NextResponse.json(
        { error: "id richiesto" },
        { status: 400 }
      );
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nessun campo da aggiornare" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select("id, name, type, status, priority")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Progetto non trovato" },
        { status: 404 }
      );
    }

    return NextResponse.json({ project: data }, { status: 200 });
  } catch (err) {
    console.error("tekkin-projects PUT error", err);
    return NextResponse.json(
      { error: "Errore aggiornamento progetto" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = requireSupabase();
    const body = await req.json();
    const id = String(body?.id || body?.projectId || "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "id richiesto" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("tekkin-projects DELETE error", err);
    return NextResponse.json(
      { error: "Errore eliminazione progetto" },
      { status: 500 }
    );
  }
}
