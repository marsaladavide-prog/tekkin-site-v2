import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient(); // <<<<< QUI

    const body = await req.json().catch(() => null);
    const versionId = body?.version_id as string | undefined;

    if (!versionId) {
      return NextResponse.json(
        { error: "version_id mancante" },
        { status: 400 }
      );
    }

    // 1) prendo la versione (senza auth check, per ora)
    const { data: version, error: versionError } = await supabase
      .from("project_versions")
      .select(
        `
        id,
        audio_url,
        project_id
      `
      )
      .eq("id", versionId)
      .single();

    if (versionError || !version) {
      console.error("Version error:", versionError);
      return NextResponse.json(
        { error: "Versione non trovata" },
        { status: 404 }
      );
    }

    const audioPath = version.audio_url as string;

    // 2) creo Signed URL per far leggere il file all analyzer
    const { data: signed, error: signedError } = await supabase.storage
      .from("tracks")
      .createSignedUrl(audioPath, 60 * 60); // 1 ora

    if (signedError || !signed?.signedUrl) {
      console.error("Signed URL error:", signedError);
      return NextResponse.json(
        { error: "Errore creazione Signed URL audio" },
        { status: 500 }
      );
    }

    const audioUrl = signed.signedUrl;

    // 3) chiamo il Tekkin Analyzer Python
    const analyzerUrl = process.env.TEKKIN_ANALYZER_URL;
    const analyzerSecret = process.env.TEKKIN_ANALYZER_SECRET;

    if (!analyzerUrl || !analyzerSecret) {
      console.error(
        "[Analyzer] Missing TEKKIN_ANALYZER_URL or TEKKIN_ANALYZER_SECRET"
      );
      return NextResponse.json(
        { error: "Analyzer config missing" },
        { status: 500 }
      );
    }

    const analyzerRes = await fetch(analyzerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-analyzer-secret": analyzerSecret,
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        version_id: versionId,
        project_id: version.project_id,
      }),
    });

    if (!analyzerRes.ok) {
      const text = await analyzerRes.text().catch(() => "");
      console.error(
        "[Analyzer] Python service error:",
        analyzerRes.status,
        text
      );
      return NextResponse.json(
        { error: "Analyzer service failed" },
        { status: 502 }
      );
    }

    // risultato che arriva dal Python
    const analysis: any = await analyzerRes.json();

    // 4) aggiorno project_versions con i dati dell Analyzer
    const { error: updateError } = await supabase
      .from("project_versions")
      .update({
        lufs:
          typeof analysis.lufs === "number" ? analysis.lufs : null,
        sub_clarity:
          typeof analysis.sub_clarity === "number"
            ? analysis.sub_clarity
            : null,
        hi_end:
          typeof analysis.hi_end === "number" ? analysis.hi_end : null,
        dynamics:
          typeof analysis.dynamics === "number"
            ? analysis.dynamics
            : null,
        stereo_image:
          typeof analysis.stereo_image === "number"
            ? analysis.stereo_image
            : null,
        tonality:
          typeof analysis.tonality === "string"
            ? analysis.tonality
            : null,
        overall_score:
          typeof analysis.overall_score === "number"
            ? analysis.overall_score
            : null,
        feedback:
          typeof analysis.feedback === "string"
            ? analysis.feedback
            : null,
      })
      .eq("id", versionId);

    if (updateError) {
      console.error("Update version error:", updateError);
      return NextResponse.json(
        { error: "Errore salvataggio analisi" },
        { status: 500 }
      );
    }

    // 5) rispondo al frontend con lo score
    return NextResponse.json(
      {
        ok: true,
        overall_score:
          typeof analysis.overall_score === "number"
            ? analysis.overall_score
            : null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Unexpected run-analyzer error:", err);
    return NextResponse.json(
      { error: "Errore inatteso Analyzer" },
      { status: 500 }
    );
  }
}
