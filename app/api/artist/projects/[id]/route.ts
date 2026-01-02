import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ id: string } | Record<string, never>>;
};

export async function GET(_req: Request, ctx: Context) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const params = await ctx.params;
    const projectId = params?.id;
    if (!projectId) {
      return NextResponse.json({ error: "Project id mancante" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: project, error: projectErr } = await admin
      .from("projects")
      .select("id, title, status, created_at, genre, mix_type, cover_url, description, user_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectErr) {
      console.error("[artist-project] project read error:", projectErr);
      return NextResponse.json({ error: "Errore lettura project" }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: "Project non trovato" }, { status: 404 });
    }

    const isOwner = project.user_id === user.id;
    let isCollaborator = false;

    if (!isOwner) {
      const { data: collabRow, error: collabErr } = await admin
        .from("project_collaborators")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (collabErr) {
        console.error("[artist-project] collaborator lookup error:", collabErr);
      }

      isCollaborator = Boolean(collabRow?.user_id);
    }

    if (!isOwner && !isCollaborator) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const { data: versions, error: versionsErr } = await admin
      .from("project_versions")
      .select(
        `
        id, created_at, version_name, mix_type,
        audio_url, audio_path,
        lufs, sub_clarity, hi_end, dynamics, stereo_image, tonality, overall_score, feedback,
        analyzer_bpm, analyzer_key,
        analyzer_reference_ai, analyzer_json,
        analyzer_ai_summary, analyzer_ai_actions, analyzer_ai_meta,
        waveform_peaks, waveform_duration, waveform_bands
      `
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (versionsErr) {
      console.error("[artist-project] versions read error:", versionsErr);
      return NextResponse.json({ error: "Errore lettura versioni" }, { status: 500 });
    }

    return NextResponse.json({
      project: {
        ...project,
        project_versions: versions ?? [],
      },
    });
  } catch (err) {
    console.error("[artist-project] unexpected:", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
