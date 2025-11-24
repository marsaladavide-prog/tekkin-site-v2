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

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId richiesto" },
      { status: 400 }
    );
  }

  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id, project_id, title, status, start_date, due_date, actual_hours"
      )
      .eq("project_id", projectId)
      .order("start_date", { ascending: true });

    if (error) throw error;

    // adatta alle shape attese dal front
    const tasks =
      data?.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        start_date: t.start_date,
        due_date: t.due_date,
        actual_hours: t.actual_hours,
      })) || [];

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("tekkin-tasks GET error", err);
    return NextResponse.json(
      { error: "Errore fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = requireSupabase();
    const body = await req.json();
    const projectId = String(body?.projectId || "").trim();
    const title = String(body?.title || "").trim();
    const status =
      body?.status === "doing"
        ? "doing"
        : body?.status === "done"
        ? "done"
        : "todo";
    const due_date =
      typeof body?.due_date === "string" && body.due_date.length > 0
        ? body.due_date
        : null;

    if (!projectId || !title) {
      return NextResponse.json(
        { error: "projectId e title sono richiesti" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        title,
        description: null,
        status,
        start_date: new Date().toISOString().slice(0, 10),
        due_date,
        estimated_hours: null,
        actual_hours: null,
      })
      .select(
        "id, project_id, title, status, start_date, due_date, actual_hours"
      )
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Insert fallita" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        task: {
          id: data.id,
          title: data.title,
          status: data.status,
          start_date: data.start_date,
          due_date: data.due_date,
          actual_hours: data.actual_hours,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("tekkin-tasks POST error", err);
    return NextResponse.json(
      { error: "Errore creazione task" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = requireSupabase();
    const body = await req.json();
    const taskId = String(body?.taskId || "").trim();
    const start_date =
      typeof body?.start_date === "string" ? body.start_date || null : undefined;
    const due_date =
      typeof body?.due_date === "string" ? body.due_date || null : undefined;
    const status =
      body?.status === "doing"
        ? "doing"
        : body?.status === "done"
        ? "done"
        : body?.status === "todo"
        ? "todo"
        : undefined;

    const patch: Record<string, any> = {};
    if (start_date !== undefined) patch.start_date = start_date;
    if (due_date !== undefined) patch.due_date = due_date;
    if (status !== undefined) patch.status = status;

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId richiesto" },
        { status: 400 }
      );
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Nessun campo da aggiornare" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", taskId)
      .select(
        "id, project_id, title, status, start_date, due_date, actual_hours"
      )
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Task non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        task: {
          id: data.id,
          title: data.title,
          status: data.status,
          start_date: data.start_date,
          due_date: data.due_date,
          actual_hours: data.actual_hours,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("tekkin-tasks PATCH error", err);
    return NextResponse.json(
      { error: "Errore aggiornamento task" },
      { status: 500 }
    );
  }
}
