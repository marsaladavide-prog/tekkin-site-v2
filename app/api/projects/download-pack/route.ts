import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const versionId = req.nextUrl.searchParams.get("version_id");
    if (!versionId) {
      return NextResponse.json(
        { error: "version_id è richiesto" },
        { status: 400 }
      );
    }

    const { data: version, error: versionError } = await supabase
      .from("project_versions")
      .select("*, projects(id,title,cover_url,description,user_id)")
      .eq("id", versionId)
      .maybeSingle();

    if (versionError) {
      console.error("[projects][download-pack] versionError", versionError);
      return NextResponse.json(
        { error: "Errore nel recupero della versione" },
        { status: 500 }
      );
    }

    if (!version) {
      return NextResponse.json(
        { error: "Versione non trovata" },
        { status: 404 }
      );
    }

    const project = version.projects;

    if (!project) {
      return NextResponse.json(
        { error: "Progetto associato non trovato" },
        { status: 500 }
      );
    }

    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: "Accesso negato" },
        { status: 403 }
      );
    }

    const pack = {
      project: project
        ? {
            id: project.id,
            title: project.title,
            cover_url: project.cover_url ?? null,
            description: project.description ?? null,
          }
        : null,
      version: {
        id: version.id,
        project_id: version.project_id,
        version_name: version.version_name,
        mix_type: version.mix_type,
        created_at: version.created_at,
        analyzer_bpm: version.analyzer_bpm,
        lufs: version.lufs,
        overall_score: version.overall_score,
        feedback: version.feedback,
        analyzer_spectral_centroid_hz: version.analyzer_spectral_centroid_hz,
        analyzer_spectral_rolloff_hz: version.analyzer_spectral_rolloff_hz,
        analyzer_spectral_bandwidth_hz: version.analyzer_spectral_bandwidth_hz,
        analyzer_spectral_flatness: version.analyzer_spectral_flatness,
        analyzer_zero_crossing_rate: version.analyzer_zero_crossing_rate,
      },
      signed_audio_url: null as string | null,
    };

    if (version.audio_url) {
      const { data: signed, error: signedError } = await supabase.storage
        .from("tracks")
        .createSignedUrl(version.audio_url, 60 * 60);
      if (signedError) {
        console.error(
          "[projects][download-pack] signedUrl error",
          signedError
        );
      } else if (signed?.signedUrl) {
        pack.signed_audio_url = signed.signedUrl;
      }
    }

    const fileName = `tekkin-pack-${version.version_name ?? version.id}`;

    return new NextResponse(JSON.stringify(pack), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}.json"`,
      },
    });
  } catch (err) {
    console.error("[projects][download-pack] unexpected", err);
    return NextResponse.json(
      { error: "Errore inatteso" },
      { status: 500 }
    );
  }
}
