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
  analyzer_mix_v1: unknown | null;
  fix_suggestions: FixSuggestion[] | null;
  analyzer_ai_summary: string | null;
  analyzer_ai_actions: AnalyzerAiAction[] | null;
  analyzer_ai_meta: AnalyzerAiMeta | null;
};

type RawMixV1 =
  | {
      metrics?: {
        loudness?: {
          integrated_lufs?: number | null;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }
  | null;

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
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const versionId = body?.version_id as string | undefined;
    const force = Boolean(body?.force);

    if (!versionId) {
      return NextResponse.json(
        { error: "version_id mancante" },
        { status: 400 }
      );
    }
    // 1. prendo i dati necessari della versione
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
          "analyzer_mix_v1",
          "analyzer_ai_summary",
          "analyzer_ai_actions",
          "analyzer_ai_meta",
      "fix_suggestions",
        ].join(", ")
      )
      .eq("id", versionId)
      .single();


    if (versionError || !data) {
      console.error("[ai-summary] Version not found:", versionError);
      return NextResponse.json(
        { error: "Version non trovata" },
        { status: 404 }
      );
    }

    const version: ProjectVersionForAi = data;

    // se ho già il risultato AI e non è richiesto force, riuso
    if (
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

    // 2. normalizzo LUFS e preparo mix_v1 "ripulito"
    const rawMixV1: RawMixV1 =
      (version.analyzer_mix_v1 as RawMixV1 | null) ?? null;

    const mainLufs: number | null =
      typeof version.lufs === "number"
        ? version.lufs
        : rawMixV1?.metrics?.loudness?.integrated_lufs ?? null;

    const mixV1ForModel =
      rawMixV1 && typeof rawMixV1 === "object"
        ? {
            ...rawMixV1,
            metrics: {
              ...rawMixV1.metrics,
              // loudness legacy rimossa per evitare mismatch tipo -12.5 LUFS
              loudness: undefined,
            },
          }
        : null;

    // 3. preparo il payload da mandare al modello
    const payloadForModel = {
version_id: version.id,
  project_id: version.project_id,
  version_name: version.version_name,
  lufs: mainLufs,
  analyzer_bpm: version.analyzer_bpm,
  overall_score: version.overall_score,
  feedback: version.feedback,
  reference_ai: version.analyzer_reference_ai,
  mix_v1: mixV1ForModel,
  fix_suggestions: (version.fix_suggestions ?? []) as FixSuggestion[] | [],
    };

    // prompt in inglese: specifico che lufs top level è la fonte autorevole
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
- mix_v1: technical metrics (loudness, balance, spectrum, stereo, structure) and a list of issues
- fix_suggestions: a list of structured suggestions generated by deterministic rules, each with:
  - issue (short title)
  - priority ("low" | "medium" | "high")
  - analysis (short explanation)
  - steps (concrete steps)

VERY IMPORTANT:
- The top level field "lufs" is the authoritative integrated LUFS value for the mix.
- If any loudness value inside mix_v1 (for example old "integrated_lufs") conflicts with "lufs", you MUST ignore the old value and follow "lufs".
- The technical parts (reference_ai, mix_v1, issues, bands_status, fix_suggestions) are already correct: you do NOT need to reinvent the analysis.
- Your job is to give a higher-level synthesis and a focused action plan, not to list again every small detail.

Your answer must be in ITALIAN, with a direct and professional tone, no fluff, no marketing hype.

Your tasks:

1) SUMMARY (max 6-7 lines)
   - In Italian.
   - Explain clearly:
     - Stato tecnico del mix/master (volume, bilanciamento, dinamica, tonalità generale).
     - Quanto è adatto al contesto club minimal / deep tech.
     - Le 2-3 criticità principali che un producer deve sapere SUBITO.
   - Non riscrivere tutti i numeri: usa solo quelli davvero rilevanti (es. LUFS, se troppo distante dal target; match di profilo se molto basso, ecc.).

2) ACTIONS (3 to 6 concrete actions, as a single aggregated plan)
   You must act as a FIX AGGREGATOR:
   - You receive mix_v1.issues, bands_status, and fix_suggestions.
   - Do NOT simply repeat each small suggestion.
   - Group related problems into 3–6 MACRO AREAS OF INTERVENTION that a producer would actually tackle in the studio.

   For each action:
   - title: short (3-6 words), Italian, molto chiaro (es. "Aumenta il sub sotto 60 Hz").
   - description: 2-3 frasi in Italiano, pratiche e specifiche (dove intervenire, range di frequenze orientativo, cosa controllare).
   - focus_area: one of
       "loudness" | "sub" | "lowmid" | "mid" | "high" | "stereo" | "structure" | "groove" | "arrangement" | "other"
   - priority: "low" | "medium" | "high"
     Use "high" ONLY for le mosse che cambiano davvero il risultato in club (es. sub assente, mix troppo scuro, loudness troppo lontano dal target).

   Use reference_ai.bands_status, mix_v1.issues and fix_suggestions to choose the priorities:
   - If many bands are "high" in lowmid and several fix_suggestions mention boxy / accumulo low-mid, then one action should be "Riduci accumulo low-mid" with practical details.
   - If match_ratio is very low and lufs_in_target = false, consider an action on global balance and/or loudness.

   Le azioni NON DEVONO ripetere testualmente i suggerimenti tecnici già presenti in "fix_suggestions" o in mix_v1.issues.
   Devono invece sintetizzare i problemi principali in MOSSE DI LIVELLO SUPERIORE che un producer esperto farebbe per preparare la traccia al mastering o al club testing.
   Pensa in termini di "macro aree di intervento", non micro-dettagli.

   Quando proponi un range di frequenze, usa range coerenti con i dati di reference_ai.bands_status.
   Evita numeri inventati o troppo specifici.

3) META (AnalyzerAiMeta)
   - artistic_assessment:
     Breve paragrafo in Italiano su quanto il pezzo è interessante o generico nella scena minimal / deep tech (NO giudizi offensivi).
   - risk_flags:
     Lista di codici sintetici SOLO se rilevanti, scegliendo tra:
       "too_dark", "too_bright", "weak_sub", "harsh_highs",
       "weak_transients", "flat_stereo", "muddy_lowmid",
       "unbalanced_vocals", "weak_drop", "structure_confusing".
     Non inventare altri codici.
   - predicted_rank_gain:
     Numero (può essere decimale) che rappresenta quanto potrebbe crescere lo score / Tekkin Rank se l'action plan viene seguito (es. 1.5, 3.0, 5.0). Usa null se non hai abbastanza informazioni.
   - label_fit:
     Una frase corta in Italiano su che tipo di label o DJ context è più adatto (es. "adatta a label underground minimal / deep tech", "più vicina a sound tech house commerciale", ecc.). Può essere null se non è chiaro.
   - structure_feedback:
     Breve paragrafo in Italiano che commenta il flusso delle sezioni (intro, build, drop, break, outro) e quanto è comodo per i DJ (es. "intro abbastanza lunga per mixare", "drop poco marcato", "break troppo lungo", ecc.).

STYLE RULES (IMPORTANT):
- Lo stile deve essere diretto, naturale, da tecnico musicale esperto, NON come un manuale o un algoritmo.
- - Puoi usare valori o range tecnici (dB, zone di frequenza) SOLO se presenti o chiaramente deducibili dal payload (reference_ai, bands_status, mix_v1). 
  Se il dato non esiste nel payload, non inventare numeri e usa descrizioni generali (es. “zona low-mid”, “parte alta brillante”).
- Alterna il modo di iniziare le frasi, non usare sempre "Riduci", "Applica", "Incrementa".
- Preferisci un tono discorsivo, chiaro, orientato alla pratica: cosa sentirebbe un producer? cosa manca nel club? cosa limita la resa?
- Ogni azione deve sembrare un consiglio umano basato sull'esperienza ("valuta se...", "potrebbe aiutare...", "spesso in questo genere funziona...").
- Non ripetere concetti già espressi nella stessa sezione.
- Mantieni la lunghezza sotto controllo: 2–3 frasi per azione bastano.

Output must be a single JSON object with this exact shape:

{
  "summary": "string",
  "actions": [
    {
      "title": "string",
      "description": "string",
      "focus_area": "loudness" | "sub" | "lowmid" | "mid" | "high" | "stereo" | "structure" | "groove" | "arrangement" | "other",
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
`;




    const userPrompt = `
JSON payload from Tekkin Analyzer:

${JSON.stringify(payloadForModel, null, 2)}
`;

    // 4. chiamata al modello
    const openAiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
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
      }
    );

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
      return NextResponse.json(
        { error: "Risposta AI vuota" },
        { status: 500 }
      );
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

    // 5. sanitazione minima
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

    // 6. salvo nel DB
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
      return NextResponse.json(
        { error: "Errore salvando i dati AI" },
        { status: 500 }
      );
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
    return NextResponse.json(
      { error: "Errore inatteso Tekkin AI" },
      { status: 500 }
    );
  }
}
