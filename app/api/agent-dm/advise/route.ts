import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Auth" }, { status: 401 });
    }

    const body = await req.json();
    const projectId = body.projectId as string | undefined;

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    // 1. FETCH PROJECT
    const { data: project, error: projectErr } = await supabase
      .from("agent_dm_projects")
      .select("*")
      .eq("id", projectId)
      .eq("user_id", auth.user.id)
      .single();

    if (projectErr || !project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // 2. FETCH TASKS
    const { data: tasks, error: tasksErr } = await supabase
      .from("agent_dm_tasks")
      .select("*")
      .eq("project_id", projectId);

    if (tasksErr) {
      return NextResponse.json({ error: "Tasks error" }, { status: 500 });
    }

    const tasksInfo = (tasks ?? []).map(t => ({
      title: t.title,
      status: t.status,
      start_date: t.start_date,
      due_date: t.due_date,
    }));

    const tasksList =
      tasksInfo
        .map(
          t =>
            `- [${t.status}] ${t.title}` +
            (t.start_date ? ` | start: ${t.start_date}` : "") +
            (t.due_date ? ` | due: ${t.due_date}` : "")
        )
        .join("\n") || "nessuno";

    // 3. FETCH GOALS (solo ultimi 5)
    const { data: goalsData } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    // 4. PREPARA IL CONTEXT COMPATTO
    const goals = goalsData?.map(g => g.label) ?? [];

    // 5. PREPARA IL PROMPT
    const systemPrompt = `
Sei Agent DM, assistente operativo personale di un produttore di musica elettronica (Davide Marsala) e founder di Tekkin.
Il tuo ruolo è fornire un piano del giorno concreto, breve e realizzabile, basato su:

- progetto selezionato
- task TODO/DOING/DONE
- goals personali
- stato generale del flusso (se ci sono troppi compiti, semplifica)

Regole:
- Rispondi SOLO in JSON valido.
- Non scrivere testo fuori dal JSON.
- Non inventare informazioni. Se manca un dato, ignoralo.
- Sii pratico e diretto, orientato all’esecuzione.
- Massimo 5 task consigliati.
- Usa start_date e due_date per decidere le priorità.
- Dai priorità a:
  - task in ritardo (due_date < oggi)
  - task che iniziano oggi (start_date = oggi)
- Non mettere nei tasks_today quelli che partono più avanti.

Formato obbligatorio:

{
  "summary": "...",
  "today_focus": ["...", "..."],
  "tasks_today": [
    { "title": "...", "reason": "..." }
  ],
  "notes": ["..."]
}
`;

    const userPrompt = `
Oggi è ${new Date().toISOString().split("T")[0]}.

Progetto selezionato:
- Nome: ${project.name}
- Categoria: ${project.category}

Tasks (con date):
${tasksList}

Goals:
${goals.length ? goals.join("\n") : "nessuno"}

Genera il piano del giorno seguendo esattamente lo schema JSON richiesto.
`;

    // 6. CHIAMATA OPENAI
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // allow overriding the model via env, fallback to a sensible default
    const model = process.env.AGENT_DM_MODEL || "gpt-4.1-mini";

    // usiamo la Chat Completions API, molto più stabile per JSON
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) {
      console.error("Empty AI response");
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
    }

    let advice;
    try {
      advice = JSON.parse(raw);
    } catch (e) {
      console.error("JSON parse error:", e, raw);
      return NextResponse.json({ error: "Invalid JSON from AI" }, { status: 500 });
    }

    return NextResponse.json({ advice });
  } catch (err: any) {
    console.error("ERROR /api/agent-dm/advise:", err);
    return NextResponse.json({ error: "AI error" }, { status: 500 });
  }
}
