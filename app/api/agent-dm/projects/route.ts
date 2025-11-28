import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return NextResponse.json({ error: "Auth" }, { status: 401 });

  const { data, error: err } = await supabase
    .from("agent_dm_projects")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json({ projects: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return NextResponse.json({ error: "Auth" }, { status: 401 });

  const body = await req.json();

  const { data, error: err } = await supabase
    .from("agent_dm_projects")
    .insert({
      user_id: auth.user.id,
      name: body.name,
      category: body.category ?? "personal",
      priority: body.priority ?? 1,
      status: "active"
    })
    .select("*")
    .single();

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json({ project: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return NextResponse.json({ error: "Auth" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error: err } = await supabase
    .from("agent_dm_projects")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
