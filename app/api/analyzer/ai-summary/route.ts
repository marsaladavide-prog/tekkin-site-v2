import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type {
  AnalyzerAiAction,
  AnalyzerAiCoach,
  AnalyzerAiMeta,
  FixSuggestion,
} from "@/types/analyzer";

type ProjectVersionForAi = {
  id: string;
  project_id: string;
  version_name: string | null;
  lufs: number | null;
  analyzer_bpm: number | null;
  overall_score: number | null;
  feedback: string | null;
  analyzer_reference_ai: unknown | null;
  fix_suggestions: FixSuggestion[] | null;
  analyzer_ai_summary: string | null;
  analyzer_ai_actions: AnalyzerAiAction[] | null;
  analyzer_ai_meta: AnalyzerAiMeta | null;
};

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[ai-summary] Auth error:", authError);
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);

    const versionId = body?.version_id as string | undefined;
    const force = Boolean(body?.force);
    const question: string | undefined =
      typeof body?.question === "string" && body.question.trim().length > 0
        ? body.question.trim()
        : undefined;

    if (!versionId) {
      return NextResponse.json({ error: "version_id mancante" }, { status: 400 });
    }

    // 1) Recupero dati versione
    const { data, error: versionError } = await supabase
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
          "analyzer_ai_summary",
          "analyzer_ai_actions",
          "analyzer_ai_meta",
          "fix_suggestions",
        ].join(", ")
      )
      .eq("id", versionId)
      .maybeSingle();

    if (versionError || !data) {
      console.error("[ai-summary] Version not found:", versionError);
      return NextResponse.json({ error: "Versione non trovata" }, { status: 404 });
    }

    const version = data as unknown as ProjectVersionForAi;

    // 2) Se non c'è question e ho già i dati AI, riuso (a meno di force)
    if (
      !question &&
      !force &&
      (version.analyzer_ai_summary ||
        version.analyzer_ai_actions ||
        version.analyzer_ai_meta)
    ) {
      return NextResponse.json(
        {
          ok: true,
          version_id: version.id,
          ai: {
            summary: version.analyzer_ai_summary ?? "",
            actions: (version.analyzer_ai_actions ?? []) as AnalyzerAiAction[],
            meta: (version.analyzer_ai_meta ?? {
              artistic_assessment: "",
              risk_flags: [],
              predicted_rank_gain: null,
              label_fit: null,
              structure_feedback: null,
            }) as AnalyzerAiMeta,
          } satisfies AnalyzerAiCoach,
        },
        { status: 200 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("[ai-summary] OPENAI_API_KEY mancante");
      return NextResponse.json(
        { error: "AI non configurata sul server" },
        { status: 500 }
      );
    }

    // Fetch chart positions for this version
    const { data: chartData, error: chartError } = await supabase
      .from("tekkin_charts_latest_snapshots_v1")
      .select("profile_key, rank_position, score_public")
      .eq("version_id", versionId);

    if (chartError) {
      console.error("[ai-summary] chart fetch error:", chartError);
    }

    const chartPositions = chartData ?? [];

    // 3) Payload per il modello (Niente mix_v1)
    const payloadForModel = {
      version_id: version.id,
      project_id: version.project_id,
      version_name: version.version_name,
      lufs: typeof version.lufs === "number" ? version.lufs : null,
      analyzer_bpm: version.analyzer_bpm,
      overall_score: version.overall_score,
      feedback: version.feedback,
      reference_ai: version.analyzer_reference_ai,
      fix_suggestions: (version.fix_suggestions ?? []) as FixSuggestion[],
      chart_positions: chartPositions,
    };

    // 4) Modalità Q&A: se arriva una question, faccio solo risposta testuale e non salvo nulla
    if (question) {
      const qSystemPrompt = `
Sei Tekkin Analyzer AI, assistente per il mix di musica minimal, deep house, tech house e affini.
Ricevi:
- Un JSON con i dati tecnici di una versione (loudness/LUFS, BPM, Reference AI, fix_suggestions, ecc).
- Una domanda precisa dell'artista su questo mix (voce, hi-hat, percussioni, dinamica, stereo, groove, ecc).

Regole:
- Rispondi SEMPRE in Italiano.
- Sii pratico e specifico, come un producer esperto in studio.
- Considera anche voce, hi-hats, percussioni, transitori, stereo e "realismo" del mix, non solo clap e kick.
- Evita di copiare/incollare fix_suggestions: usale come base, ma scrivi naturale e mirato.
- Limita la risposta a 2-4 paragrafi brevi, massimo 8-10 frasi totali.
      `.trim();

      const qUserPrompt = `
Dati tecnici JSON da Tekkin Analyzer:

${JSON.stringify(payloadForModel, null, 2)}

Domanda dell'artista:
${question}

Rispondi in Italiano in modo diretto e pratico, riferendoti chiaramente a questo mix.
      `.trim();

      const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: qSystemPrompt },
            { role: "user", content: qUserPrompt },
          ],
          temperature: 0.5,
        }),
      });

      if (!openAiRes.ok) {
        const text = await openAiRes.text().catch(() => "");
        console.error("[ai-summary][Q&A] OpenAI error:", openAiRes.status, text);
        return NextResponse.json(
          { error: "Errore chiamando Tekkin AI Q&A", detail: text || null },
          { status: 502 }
        );
      }

      const completion = await openAiRes.json().catch(() => null);
      const rawContent: string | null =
        completion?.choices?.[0]?.message?.content ?? null;

      if (!rawContent) {
        console.error("[ai-summary][Q&A] Nessun contenuto dal modello");
        return NextResponse.json({ error: "Risposta AI vuota" }, { status: 500 });
      }

      return NextResponse.json({ answer: rawContent }, { status: 200 });
    }

    // 5) Modalità "coach" completa con JSON strutturato
    const systemPrompt = `
You are Tekkin AI, a specialist assistant for minimal / deep tech / tech house club tracks.

You receive a JSON payload with:
- basic metrics (LUFS, BPM, overall_score)
- a detailed technical text report ("feedback")
- reference_ai: result of a genre reference model, with
  - profile_key / profile_label
  - match_ratio and bands_in_target / bands_total
  - lufs_in_target, crest_in_target, tone_tag
  - bands_status: for each band (sub, low, lowmid, mid, presence, high) you have
    value, target_min, target_max, status ("low", "ok", "high")
  - optional model_match, guessed_genre, reference tracks, adjustments
- fix_suggestions: a list of structured suggestions generated by deterministic rules, each with:
  - issue (short title)
  - priority ("low" | "medium" | "high")
  - analysis (short explanation)
  - steps (concrete steps)
- chart_positions: current positions in Tekkin charts (profile_key, rank_position, score_public)

VERY IMPORTANT:
- The top level field "lufs" is the authoritative integrated LUFS value for the mix.
- The technical parts (reference_ai, bands_status, fix_suggestions) are already correct: you do NOT need to reinvent the analysis.
- Your job is to give a higher-level synthesis and a focused action plan, not to list again every small detail.
- Always pay attention to voice presence (when present), hi-hat and percussive texture, realism / tridimensionality of the mix, and the overall dynamics / punch.
- Avoid repeating identical suggestions (same wording or target instrument) across actions or summary lines.
- When the suggestion touches on groove, explain how hi-hats / percussions and dynamics work together to create real movement.

Your answer must be in ITALIAN, with a direct and professional tone, no fluff, no marketing hype.

Your tasks:

1) SUMMARY (max 4–5 lines)
   - In Italian.
   - Spiega in modo diretto:
     - Stato tecnico del mix/master (volume, bilanciamento, dinamica, tonalità).
     - Quanto è adatto al contesto club minimal / deep tech.
     - Le 2 criticità principali che il producer deve sapere SUBITO.
     - Posizione attuale nelle charts se presente (es. "Attualmente #X nella chart globale").
   - Fai almeno un cenno a: voce (se presente), hi-hat/percussioni oppure stereo width.
   - NON elencare tutti i dettagli tecnici: solo quelli che cambiano davvero la vita.

2) ACTIONS (massimo 4 AZIONI, non di più)
   Devi agire come un FIX AGGREGATOR:
   - Ricevi bands_status e fix_suggestions.
   - NON riscrivere tutte le micro-note.
   - Raggruppa i problemi in 3–4 MACRO AREE DI INTERVENTO che un producer farebbe davvero in studio.

   Per ogni azione:
   - title: 3–6 parole, in Italiano, chiarissimo.
   - description: massimo 2 frasi in Italiano, pratiche e specifiche.
   - focus_area: uno tra
       "loudness" | "sub" | "lowmid" | "mid" | "high" | "stereo" | "stereo_high" | "vocals" | "hihats" | "percussions" | "transients" | "punch" | "structure" | "groove" | "arrangement" | "other"
   - priority: "low" | "medium" | "high"

   Regole aggiuntive:
   - Se più fix_suggestions dicono la stessa cosa, tu la scrivi UNA volta sola in forma di macro-mossa.
   - Se hai già un’azione su percussioni/hi-hat, non crearne un’altra quasi identica.
   - Se hai dubbi, meglio una azione in meno ma chiara che tante azioni ripetitive.

3) META (AnalyzerAiMeta)
   - artistic_assessment:
     Short paragraph in Italian about how interesting or generic the track is in the minimal / deep tech scene.
   - risk_flags:
     List of short codes only if relevant, chosen from:
       "too_dark", "too_bright", "weak_sub", "harsh_highs",
       "weak_transients", "flat_stereo", "muddy_lowmid",
       "unbalanced_vocals", "weak_drop", "structure_confusing".
   - predicted_rank_gain:
     Number (can be decimal) or null if unsure. Consider current chart_positions to estimate potential improvement.
   - label_fit:
     Short sentence in Italian about DJ/label context, or null if not clear.
   - structure_feedback:
     Short paragraph in Italian about sections and DJ-friendliness.

Output must be a single JSON object with this exact shape:

{
  "summary": "string",
  "actions": [
    {
      "title": "string",
      "description": "string",
      "focus_area": "loudness" | "sub" | "lowmid" | "mid" | "high" | "stereo" | "stereo_high" | "vocals" | "hihats" | "percussions" | "transients" | "punch" | "structure" | "groove" | "arrangement" | "other",
      "priority": "low" | "medium" | "high"
    }
  ],
  "meta": {
    "artistic_assessment": "string",
    "risk_flags": ["string"],
    "predicted_rank_gain": number | null,
    "label_fit": "string | null",
    "structure_feedback": "string | null"
  }
}

Respond ONLY with valid JSON. No markdown, no comments, no extra text.
    `.trim();

    const userPrompt = `
JSON payload from Tekkin Analyzer:

${JSON.stringify(payloadForModel, null, 2)}
    `.trim();

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
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
      console.error("[ai-summary] OpenAI error:", openAiRes.status, text);
      return NextResponse.json(
        { error: "Errore chiamando Tekkin AI", detail: text || null },
        { status: 502 }
      );
    }

    const completion = await openAiRes.json().catch(() => null);
    const rawContent: string | null =
      completion?.choices?.[0]?.message?.content ?? null;

    if (!rawContent) {
      console.error("[ai-summary] Nessun contenuto dal modello");
      return NextResponse.json({ error: "Risposta AI vuota" }, { status: 500 });
    }

    let parsed: AnalyzerAiCoach | null = null;

    try {
      parsed = JSON.parse(rawContent) as AnalyzerAiCoach;
    } catch (e) {
      console.error("[ai-summary] JSON parse error:", e, rawContent);
      return NextResponse.json(
        { error: "Risposta AI non in formato JSON" },
        { status: 500 }
      );
    }

    const summary = parsed.summary ?? "";
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    const rawRiskFlags = parsed.meta?.risk_flags;

    const meta: AnalyzerAiMeta = {
      artistic_assessment: parsed.meta?.artistic_assessment ?? "",
      risk_flags: Array.isArray(rawRiskFlags)
        ? rawRiskFlags.filter((flag): flag is string => typeof flag === "string")
        : [],
      predicted_rank_gain: parsed.meta?.predicted_rank_gain ?? null,
      label_fit: parsed.meta?.label_fit ?? null,
      structure_feedback: parsed.meta?.structure_feedback ?? null,
    };

    const { error: updateError } = await supabase
      .from("project_versions")
      .update({
        analyzer_ai_summary: summary,
        analyzer_ai_actions: actions,
        analyzer_ai_meta: meta,
      })
      .eq("id", version.id);

    if (updateError) {
      console.error("[ai-summary] Update error:", updateError);
      return NextResponse.json({ error: "Errore salvando i dati AI" }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        version_id: version.id,
        ai: {
          summary,
          actions,
          meta,
        } satisfies AnalyzerAiCoach,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[ai-summary] Unexpected error:", err);
    return NextResponse.json({ error: "Errore inatteso Tekkin AI" }, { status: 500 });
  }
}
