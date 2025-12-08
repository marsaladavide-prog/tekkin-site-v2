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
  const { projectId, title, status, start_date, due_date, actual_hours, priority } = body;

  const { data, error: err } = await supabase
    .from("agent_dm_tasks")
    .insert({
      project_id: projectId,
      title,
      status: status ?? "todo",
      start_date: start_date || null,
      due_date: due_date || null,
      actual_hours,
      priority,
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
  const { id, start_date, due_date, ...rest } = body;
  const updateData: Record<string, unknown> = { ...rest };

  if ("start_date" in body) {
    updateData.start_date = start_date || null;
  }
  if ("due_date" in body) {
    updateData.due_date = due_date || null;
  }

  const { data, error: err } = await supabase
    .from("agent_dm_tasks")
    .update(updateData)
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
