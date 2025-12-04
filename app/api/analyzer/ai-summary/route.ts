import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type {
  AnalyzerAiAction,
  AnalyzerAiCoach,
  AnalyzerAiMeta,
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
    };

    // prompt in inglese: specifico che lufs top level è la fonte autorevole
    const systemPrompt = `
You are Tekkin AI, a specialist assistant for minimal / tech house / minimal deep tech mixing and mastering.

You receive a JSON payload with:
- basic metrics (LUFS, overall_score)
- a detailed technical text report
- reference_ai (genre profile, tonal balance, band statuses, model_match with match_percent, guessed_genre, reference tracks, adjustments)
- mix_v1 (technical metrics for loudness, stems balance, spectrum, stereo, structure, and a list of issues)

Important:
- The top level field "lufs" is the authoritative integrated LUFS value for the mix.
- If any loudness value inside mix_v1 (for example old "integrated_lufs") conflicts with "lufs", you must ignore the old value and follow "lufs".

Your job is to analyze the data and produce:
1) A short summary (max 6-7 lines) in Italian, clear and direct, describing:
   - technical state of the mix/master
   - artistic suitability for minimal / deep tech club context
   - any critical problems.

2) A list of 3 to 6 concrete actions (AnalyzerAiAction) with:
   - title (short, 3-6 words, Italian)
   - description (2-3 sentences, Italian, practical steps)
   - focus_area (one of: loudness, sub, lowmid, mid, high, stereo, structure, groove, arrangement, other)
   - priority (low, medium, high) based on impact and urgency.

3) A meta block (AnalyzerAiMeta) containing:
   - artistic_assessment: short paragraph in Italian about how "interesting" or "generic" the track feels in the scene.
   - risk_flags: list of short codes describing risks, for example:
       "too_dark", "too_bright", "weak_sub", "harsh_highs", "weak_transients",
       "flat_stereo", "muddy_lowmid", "unbalanced_vocals", "weak_drop", "structure_confusing".
     Use only if relevant.
   - predicted_rank_gain: a numeric estimate (can be decimal) of how much the Tekkin Rank (or similar score) could increase if the proposed actions are implemented. Or null if you cannot estimate.
   - label_fit: one short sentence in Italian describing what kind of label or DJ context best fits the current version (e.g. "adatta a label underground minimal / deep tech", "più vicina a sound tech house commerciale", etc).
   - structure_feedback: one short paragraph in Italian commenting on arrangement/sections (intro, build, drop, break, outro) and whether the energy flow works for DJs.

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

Respond only with valid JSON. No markdown, no comments, no extra text.
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
