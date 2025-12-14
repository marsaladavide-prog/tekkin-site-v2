import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type AskBody = {
  version_id?: string;
  question?: string;
};

type ProjectVersionForAsk = {
  id: string;
  project_id: string;
  version_name: string | null;
  lufs: number | null;
  analyzer_bpm: number | null;
  overall_score: number | null;
  feedback: string | null;
  analyzer_reference_ai: unknown | null;
  fix_suggestions: unknown[] | null;
  analyzer_ai_summary: string | null;
  analyzer_ai_actions: unknown[] | null;
  analyzer_ai_meta: unknown | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as AskBody | null;

    const versionId =
      typeof body?.version_id === "string" && body.version_id.trim().length > 0
        ? body.version_id.trim()
        : null;

    const question =
      typeof body?.question === "string" && body.question.trim().length > 0
        ? body.question.trim()
        : null;

    if (!versionId || !question) {
      return NextResponse.json(
        { error: "version_id o question mancanti" },
        { status: 400 }
      );
    }

    const { data, error: vErr } = await supabase
      .from("project_versions")
      .select(
        [
          "id",
          "project_id",
          "version_name",
          "lufs",
          "analyzer_bpm",
          "overall_score",
          "feedback",
          "analyzer_reference_ai",
          "fix_suggestions",
          "analyzer_ai_summary",
          "analyzer_ai_actions",
          "analyzer_ai_meta",
        ].join(", ")
      )
      .eq("id", versionId)
      .maybeSingle();

    if (vErr || !data) {
      return NextResponse.json(
        { error: "Versione non trovata" },
        { status: 404 }
      );
    }

    const version = data as unknown as ProjectVersionForAsk;

    const payloadForModel = {
      version_id: version.id,
      project_id: version.project_id,
      version_name: version.version_name,
      lufs: version.lufs,
      analyzer_bpm: version.analyzer_bpm,
      overall_score: version.overall_score,
      feedback: version.feedback,
      reference_ai: version.analyzer_reference_ai,
      fix_suggestions: version.fix_suggestions,
      ai_summary: version.analyzer_ai_summary,
      ai_actions: version.analyzer_ai_actions,
      ai_meta: version.analyzer_ai_meta,
    };

    const systemPrompt = `
Sei Tekkin AI Assistant, un assistente tecnico minimale per produttori musicali.
Rispondi SEMPRE in italiano, massimo 5-6 righe, tono diretto, tecnico e pratico.

Ricevi:
- dati di analisi (LUFS, BPM, overall_score)
- reference AI (bilanciamento, bande fuori target, coerenza di genere)
- fix_suggestions (azioni concrete applicabili)
- riassunto AI della versione
- la DOMANDA dell’utente

REGOLE:
- Rispondi SOLO alla domanda.
- Usa esclusivamente i dati presenti nel payload.
- NON inventare numeri, frequenze o problemi non rilevati.
- Puoi citare bande (sub, lowmid, mid, high, air) solo se presenti nei dati.
- Evita teoria inutile.
- Fornisci almeno un’azione immediatamente applicabile.

Output: SOLO testo, nessun JSON, nessun markup.
    `.trim();

    const userPrompt = `
DATI ANALISI:

${JSON.stringify(payloadForModel, null, 2)}

DOMANDA UTENTE:
"${question}"
    `.trim();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY non configurata" },
        { status: 500 }
      );
    }

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
      }),
    });

    if (!openAiRes.ok) {
      const text = await openAiRes.text().catch(() => "");
      return NextResponse.json(
        { error: "Errore OpenAI", detail: text || null },
        { status: 502 }
      );
    }

    const completion = await openAiRes.json().catch(() => null);
    const answer: string =
      completion?.choices?.[0]?.message?.content &&
      typeof completion.choices[0].message.content === "string"
        ? completion.choices[0].message.content
        : "Nessuna risposta";

    return NextResponse.json({ ok: true, answer });
  } catch (err) {
    console.error("ask route error:", err);
    return NextResponse.json(
      { error: "Errore inatteso in Tekkin AI Assistant" },
      { status: 500 }
    );
  }
}
