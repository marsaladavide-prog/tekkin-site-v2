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

function normalizeTaskRecord(t: any) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    start_date: t.start_date,
    due_date: t.due_date,
    actual_hours: t.actual_hours,
    priority:
      t.priority === null || t.priority === undefined
        ? 5
        : Number.isFinite(Number(t.priority))
        ? Number(t.priority)
        : 5,
  };
}

function isMissingColumnError(err: any, column: string) {
  return (
    err &&
    typeof err === "object" &&
    (err as any).code === "42703" &&
    typeof (err as any).message === "string" &&
    (err as any).message.includes(column)
  );
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
    let tasks: any[] = [];
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, project_id, title, status, priority, start_date, due_date, actual_hours"
        )
        .eq("project_id", projectId)
        .order("start_date", { ascending: true });

      if (error) throw error;
      tasks = data || [];
    } catch (err: any) {
      if (isMissingColumnError(err, "priority")) {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, project_id, title, status, start_date, due_date, actual_hours")
          .eq("project_id", projectId)
          .order("start_date", { ascending: true });
        if (error) throw error;
        tasks = data || [];
      } else {
        throw err;
      }
    }

    const mapped = tasks.map(normalizeTaskRecord);

    return NextResponse.json({ tasks: mapped });
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
    const priority =
      body?.priority !== undefined && Number.isFinite(Number(body.priority))
        ? Number(body.priority)
        : 5;

    if (!projectId || !title) {
      return NextResponse.json(
        { error: "projectId e title sono richiesti" },
        { status: 400 }
      );
    }

    let inserted: any = null;
    try {
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
          priority,
        })
        .select(
          "id, project_id, title, status, priority, start_date, due_date, actual_hours"
        )
        .maybeSingle();

      if (error) throw error;
      inserted = data;
    } catch (err: any) {
      if (isMissingColumnError(err, "priority")) {
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
          .select("id, project_id, title, status, start_date, due_date, actual_hours")
          .maybeSingle();
        if (error) throw error;
        inserted = data;
      } else {
        throw err;
      }
    }

    if (!inserted) {
      return NextResponse.json(
        { error: "Insert fallita" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        task: normalizeTaskRecord(inserted),
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
    const taskId = String(body?.taskId || body?.id || "").trim();
  const start_date =
    body?.start_date === null
      ? null
      : typeof body?.start_date === "string"
      ? body.start_date || null
      : undefined;
  const due_date =
    body?.due_date === null
      ? null
      : typeof body?.due_date === "string"
      ? body.due_date || null
      : undefined;
    const status =
      body?.status === "doing"
        ? "doing"
        : body?.status === "done"
        ? "done"
        : body?.status === "todo"
        ? "todo"
        : undefined;
    const priority =
      body?.priority !== undefined && Number.isFinite(Number(body.priority))
        ? Number(body.priority)
        : undefined;

    const patch: Record<string, any> = {};
    if (start_date !== undefined) patch.start_date = start_date;
    if (due_date !== undefined) patch.due_date = due_date;
    if (status !== undefined) patch.status = status;
    if (priority !== undefined) patch.priority = priority;

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

    const runUpdate = async (omitPriority: boolean) => {
      const payload = { ...patch };
      if (omitPriority) {
        delete (payload as any).priority;
      }
      const { data, error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", taskId)
        .select(
          "id, project_id, title, status, priority, start_date, due_date, actual_hours"
        )
        .maybeSingle();
      if (error) throw error;
      return data;
    };

    let data;
    try {
      data = await runUpdate(false);
    } catch (err: any) {
      if (isMissingColumnError(err, "priority")) {
        data = await runUpdate(true);
      } else {
        throw err;
      }
    }

    if (!data) {
      return NextResponse.json(
        { error: "Task non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        task: normalizeTaskRecord(data),
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

export async function PUT(req: NextRequest) {
  try {
    const supabase = requireSupabase();
    const body = await req.json();
    const taskId = String(body?.taskId || body?.id || "").trim();
    if (!taskId) {
      return NextResponse.json(
        { error: "taskId richiesto" },
        { status: 400 }
      );
    }

    const patch: Record<string, any> = {};
    const status =
      body?.status === "doing"
        ? "doing"
        : body?.status === "done"
        ? "done"
        : body?.status === "todo"
        ? "todo"
        : undefined;
    const priority =
      body?.priority !== undefined && Number.isFinite(Number(body.priority))
        ? Number(body.priority)
        : undefined;
    const due_date =
      body?.due_date === null
        ? null
        : typeof body?.due_date === "string"
        ? body.due_date || null
        : undefined;
    const start_date =
      body?.start_date === null
        ? null
        : typeof body?.start_date === "string"
        ? body.start_date || null
        : undefined;
    if (typeof body?.title === "string") {
      const title = body.title.trim();
      if (title) patch.title = title;
    }

    if (status !== undefined) patch.status = status;
    if (priority !== undefined) patch.priority = priority;
    if (due_date !== undefined) patch.due_date = due_date;
    if (start_date !== undefined) patch.start_date = start_date;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Nessun campo da aggiornare" },
        { status: 400 }
      );
    }

    const runUpdate = async (omitPriority: boolean) => {
      const payload = { ...patch };
      if (omitPriority) {
        delete (payload as any).priority;
      }
      const { data, error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", taskId)
        .select(
          "id, project_id, title, status, priority, start_date, due_date, actual_hours"
        )
        .maybeSingle();
      if (error) throw error;
      return data;
    };

    let data;
    try {
      data = await runUpdate(false);
    } catch (err: any) {
      if (isMissingColumnError(err, "priority")) {
        data = await runUpdate(true);
      } else {
        throw err;
      }
    }

    if (!data) {
      return NextResponse.json(
        { error: "Task non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        task: normalizeTaskRecord(data),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("tekkin-tasks PUT error", err);
    return NextResponse.json(
      { error: "Errore aggiornamento task" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = requireSupabase();
    const body = await req.json();
    const taskId = String(body?.taskId || body?.id || "").trim();
    if (!taskId) {
      return NextResponse.json(
        { error: "taskId richiesto" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) throw error;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("tekkin-tasks DELETE error", err);
    return NextResponse.json(
      { error: "Errore eliminazione task" },
      { status: 500 }
    );
  }
}
