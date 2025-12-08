import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const versionId = body?.version_id;
    const question = body?.question;

    if (!versionId || !question) {
      return NextResponse.json(
        { error: "version_id o question mancanti" },
        { status: 400 }
      );
    }

    // Recupero i dati della versione come contesto
    const { data: version, error: vErr } = await supabase
      .from("project_versions")
      .select(
        `
        id,
        project_id,
        version_name,
        lufs,
        analyzer_bpm,
        overall_score,
        feedback,
        analyzer_reference_ai,
        analyzer_mix_v1,
        fix_suggestions,
        analyzer_ai_summary,
        analyzer_ai_actions,
        analyzer_ai_meta
      `
      )
      .eq("id", versionId)
      .single();

    if (vErr || !version) {
      return NextResponse.json(
        { error: "Versione non trovata" },
        { status: 404 }
      );
    }

    // Prompt dedicato al Q&A
    const systemPrompt = `
Sei Tekkin AI Assistant, un assistente tecnico minimizzato.
Rispondi SEMPRE in italiano, in massimo 5–6 righe, con tono diretto, tecnico e pratico.

Ricevi:
- i dati dell'analisi (lufs, bpm, overall_score)
- il reference_ai (bilanciamento, bande fuori target, tonalità)
- mix_v1 (issues tecniche)
- fix_suggestions (azioni specifiche)
- riassunto AI della versione
- la DOMANDA dell’utente

REGOLE:
- Rispondi SOLO alla domanda dell’utente.
- Usa i dati reali del payload quando presenti.
- NON inventare numeri o frequenze non presenti nel payload.
- Puoi citare bande (sub, lowmid, mid, high, presence) se rilevanti.
- Mantieni la risposta pratica, utile, NON teorica.
- NON ripetere l’intera analisi precedente.
- Dai un consiglio immediatamente utilizzabile.

Output: SOLO testo, nessun JSON, nessun markup.
`;

    const userPrompt = `
DATI ANALISI:

${JSON.stringify(version, null, 2)}

DOMANDA UTENTE:
"${question}"
`;

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
      const text = await openAiRes.text();
      return NextResponse.json(
        { error: "Errore OpenAI", detail: text },
        { status: 502 }
      );
    }

    const completion = await openAiRes.json();
    const answer = completion?.choices?.[0]?.message?.content ?? "Nessuna risposta";

    return NextResponse.json({ ok: true, answer });
  } catch (err) {
    console.error("ask route error:", err);
    return NextResponse.json(
      { error: "Errore inatteso in Tekkin AI Assistant" },
      { status: 500 }
    );
  }
}
