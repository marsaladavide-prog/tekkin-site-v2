import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return NextResponse.json({ error: "Auth" }, { status: 401 });

  const projectId = new URL(req.url).searchParams.get("projectId");

  const { data, error: err } = await supabase
    .from("agent_dm_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("due_date", { ascending: true });

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return NextResponse.json({ error: "Auth" }, { status: 401 });

  const body = await req.json();

  const { data, error: err } = await supabase
    .from("agent_dm_tasks")
    .insert({
      project_id: body.projectId,
      title: body.title,
      status: body.status ?? "todo",
      start_date: body.start_date,
      due_date: body.due_date,
      actual_hours: body.actual_hours,
      priority: body.priority
    })
    .select("*")
    .single();

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json({ task: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return NextResponse.json({ error: "Auth" }, { status: 401 });

  const body = await req.json();
  const id = body.id;

  const { data, error: err } = await supabase
    .from("agent_dm_tasks")
    .update(body)
    .eq("id", id)
    .select("*")
    .single();

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json({ task: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return NextResponse.json({ error: "Auth" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");

  const { error: err } = await supabase
    .from("agent_dm_tasks")
    .delete()
    .eq("id", id);

  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
