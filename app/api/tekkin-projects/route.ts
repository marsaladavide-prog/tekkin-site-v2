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
