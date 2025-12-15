import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

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

const SYSTEM_PROMPT = `
Sei l’Agente Tekkin.  
Devi analizzare progetti, task, ore, scadenze e transazioni economiche dell’utente.  
Non generi MAI testo libero.  
Rispondi SEMPRE e SOLO con un JSON valido secondo la struttura seguente.

{
  "summary": {
    "headline": "...",
    "bullets": ["...", "...", "..."]
  },
  "sections": [
    {
      "title": "Oggi / Prossime 24h",
      "tasks": [
        {
          "task_id": "",
          "label": "",
          "project": "",
          "status": "todo/doing/done",
          "due_date": "",
          "priority": "low/medium/high"
        }
      ]
    },
    {
      "title": "Prossimi 2-7 giorni",
      "tasks": []
    }
  ],
  "gantt": [
    {
      "project": "",
      "task": "",
      "status": "todo/doing/done",
      "start": "YYYY-MM-DD",
      "end":   "YYYY-MM-DD"
    }
  ],
  "finance": {
    "summary": "",
    "entries": [
      {
        "type": "income/expense",
        "label": "",
        "amount": 0,
        "category": ""
      }
    ]
  },
  "operations": [
    {
      "type": "update_task/create_task/update_project",
      "match_by": { },
      "new_status": "",
      "add_actual_hours": 0,
      "comment": ""
    }
  ]
}

REGOLE IMPORTANTI:

1. Non usare testo libero fuori dal JSON.
2. "summary.headline" deve essere una frase molto breve (max 12 parole).
3. "summary.bullets" massimo 3 punti chiari e diretti.
4. Raggruppa i task nelle due sezioni:  
   - "Oggi / Prossime 24h"  
   - "Prossimi 2-7 giorni"
5. In "gantt" mostra solo 3-7 progetti significativi in modo sintetico.
6. In "finance.summary" una singola frase secca (positivo/negativo e motivo).
7. In "operations" inserisci SOLO operazioni sicure (es. update_task).  
   Se non ci sono operazioni da fare, usa un array vuoto [].
8. Non creare progetti immaginari. Usa solo quelli presenti nei dati in input.
9. Non ripetere task completati se non rilevanti.
10. Le date devono essere ISO string (YYYY-MM-DD).
11. Se il dato non è noto, lascia "" o [].

Il JSON generato deve essere SEMPRE valido.
`;

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json(
        { error: "Config Supabase mancante" },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, SUPABASE_OPTIONS);

    const body = await req.json();
    const message = body?.message;
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Messaggio non valido" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY mancante" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) Stato attuale da Supabase

    // Projects
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, type, status, priority, created_at")
      .order("created_at", { ascending: true });

    if (projectsError) {
      console.error("Errore Supabase projects:", projectsError);
      throw projectsError;
    }

    // Tasks
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(
        "id, project_id, title, status, start_date, due_date, estimated_hours, actual_hours, projects(name)"
      )
      .order("start_date", { ascending: true });

    if (tasksError) {
      console.error("Errore Supabase tasks:", tasksError);
      throw tasksError;
    }

    // Finances
    const { data: finances, error: financesError } = await supabase
      .from("finances")
      .select("id, date, type, amount, category, description")
      .order("date", { ascending: true });

    if (financesError) {
      console.error("Errore Supabase finances:", financesError);
      throw financesError;
    }

    // Calendar events – prossimi 30 giorni
    const now = new Date();
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);

    const { data: calendarEvents, error: calendarError } = await supabase
      .from("calendar_events")
      .select(
        "id, title, start_time, end_time, related_project_id, source"
      )
      .gte("start_time", now.toISOString())
      .lte("start_time", in30.toISOString())
      .order("start_time", { ascending: true });

    if (calendarError) {
      console.error("Errore Supabase calendar_events:", calendarError);
      throw calendarError;
    }

    const state = {
      projects: projects ?? [],
      tasks: tasks ?? [],
      finances: finances ?? [],
      calendar_events: calendarEvents ?? [],
    };

    // 2) Chiamata a OpenAI – modello economico
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            "Stato attuale (JSON):\n" +
            JSON.stringify(state) +
            "\n\nMessaggio:\n" +
            message,
        },
      ],
    });

    const content = completion.choices[0].message.content ?? "";
    let response: any = null;
    try {
      response = JSON.parse(content);
    } catch (_parseErr) {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          response = JSON.parse(match[0]);
        } catch (fallbackErr) {
          console.error("Parse fallback operations failed", fallbackErr);
        }
      }
    }

    if (response?.operations) {
      await applyOperations(response.operations);
    }

    // se � gi� un payload strutturato, rispondiamo con quello
    if (
      response &&
      typeof response === "object" &&
      response.summary &&
      response.sections &&
      response.gantt &&
      response.finance
    ) {
      return NextResponse.json(response, { status: 200 });
    }

    // altrimenti, ripulisci il testo da eventuali fence ```json
    const cleanContent = (() => {
      const t = content.trim();
      if (t.startsWith("```")) {
        const idx = t.indexOf("\n");
        const end = t.lastIndexOf("```");
        if (idx !== -1 && end !== -1 && end > idx) {
          return t.slice(idx + 1, end).trim();
        }
      }
      return t;
    })();

    return NextResponse.json({ content: cleanContent }, { status: 200 });
  } catch (err) {
    console.error("tekkin-agent error", err);
    const status =
      typeof (err as any)?.status === "number"
        ? (err as any).status
        : 500;
    const message =
      (err as any)?.error?.message ||
      (err as any)?.message ||
      "Errore interno dell'agente";
    return NextResponse.json({ error: message }, { status });
  }
}

async function applyOperations(operations: any[]) {
  if (!operations || operations.length === 0) return;
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, SUPABASE_OPTIONS);

  for (const op of operations) {
    if (op.type !== "update_task" && op.type !== "create_task") continue;

    // UPDATE TASK (ore / status)
    if (op.type === "update_task") {
      const matchBy = op.match_by || {};
      const taskIdFromOp: string | undefined = matchBy.task_id;
      const projectName: string | undefined = matchBy.project_name;
      const titleContains: string | undefined = matchBy.task_title_contains;

      let taskRow: { id: string; actual_hours: number | null; status: string } | null = null;

      // 1) match diretto per task_id se presente
      if (taskIdFromOp) {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, actual_hours, status")
          .eq("id", taskIdFromOp)
          .maybeSingle();

        if (error) {
          console.error("update_task: errore fetch per task_id", error);
          continue;
        }
        if (!data) continue;
        taskRow = data;
      } else {
        // 2) match via project_name + titolo
        if (!projectName) {
          console.warn("update_task: manca project_name e task_id, skip");
          continue;
        }

        const { data: proj, error: projErr } = await supabase
          .from("projects")
          .select("id")
          .eq("name", projectName)
          .maybeSingle();

        if (projErr) {
          console.error("update_task: errore fetch progetto", projErr);
          continue;
        }
        if (!proj) continue;

        let query = supabase
          .from("tasks")
          .select("id, actual_hours, status")
          .eq("project_id", proj.id);

        if (titleContains && titleContains.trim() !== "") {
          query = query.ilike("title", `%${titleContains}%`);
        }

        const { data: tasksData, error: tasksErr } = await query.limit(1);

        if (tasksErr) {
          console.error("update_task: errore fetch task", tasksErr);
          continue;
        }
        if (!tasksData || tasksData.length === 0) continue;

        taskRow = tasksData[0];
      }

      if (!taskRow) continue;

      const patch: any = {};

      // aggiorna ore se richiesto
      if (op.add_actual_hours != null) {
        const add = Number(op.add_actual_hours) || 0;
        patch.actual_hours = (taskRow.actual_hours ?? 0) + add;
      }

      // aggiorna status se richiesto
      if (op.new_status && typeof op.new_status === "string") {
        patch.status = op.new_status;
      }

      if (Object.keys(patch).length === 0) continue;

      const { error: updateErr } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", taskRow.id);

      if (updateErr) {
        console.error("update_task: errore update", updateErr);
      }
    }

    // CREATE TASK (non la userà molto ora, ma tenerla non fa male)
    if (op.type === "create_task") {
      const { project_name, title, status, due_date } = op;
      if (!project_name || !title) continue;

      const { data: proj, error: projErr } = await supabase
        .from("projects")
        .select("id")
        .eq("name", project_name)
        .maybeSingle();

      if (projErr) {
        console.error("create_task: errore fetch progetto", projErr);
        continue;
      }
      if (!proj) continue;

      const { error: insertErr } = await supabase.from("tasks").insert({
        project_id: proj.id,
        title,
        description: null,
        status: status ?? "todo",
        start_date: new Date().toISOString().slice(0, 10),
        due_date: due_date ?? null,
        estimated_hours: 1,
        actual_hours: 0,
        order_index: 0,
      });

      if (insertErr) {
        console.error("create_task: errore insert task", insertErr);
      }
    }
  }
}
