import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const { id } = ctx.params;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: event, error: eErr } = await supabase
    .from("spotlight_events")
    .select("*")
    .eq("id", id)
    .single();
  if (eErr || !event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { data: stories, error: sErr } = await supabase
    .from("spotlight_stories")
    .select("*")
    .eq("event_id", id)
    .order("taken_at", { ascending: false });

  return NextResponse.json({
    event,
    stories: stories || []
  });
}
