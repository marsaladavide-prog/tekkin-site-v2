// app/api/agent-dm/goals/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) {
    return NextResponse.json({ error: "Auth" }, { status: 401 });
  }

  const { data, error: err } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ goals: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) {
    return NextResponse.json({ error: "Auth" }, { status: 401 });
  }

  const body = await req.json();
  const { label, due_date } = body;

  if (!label) {
    return NextResponse.json({ error: "Missing label" }, { status: 400 });
  }

  const { data, error: err } = await supabase
    .from("goals")
    .insert({
      user_id: auth.user.id,
      label,
      due_date: due_date || null,
      progress: 0,
    })
    .select("*")
    .single();

  if (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) {
    return NextResponse.json({ error: "Auth" }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...update } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data, error: err } = await supabase
    .from("goals")
    .update(update)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("*")
    .single();

  if (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) {
    return NextResponse.json({ error: "Auth" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error: err } = await supabase
    .from("goals")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
