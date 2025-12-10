import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase } from "@/app/api/projects/helpers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { supabase, user, authError } = await getAuthenticatedSupabase();

    if (authError || !user) {
      return NextResponse.json({ error: "Autenticazione richiesta" }, { status: 401 });
    }

    const body = await req.json();
    const projectId = String(body?.project_id ?? "").trim();

    if (!projectId) {
      return NextResponse.json({ error: "project_id richiesto" }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (projectError) {
      console.error("Fetch project for delete failed:", projectError);
      return NextResponse.json({ error: "Errore recupero project" }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: "Project non trovato" }, { status: 404 });
    }

    const cleanupTargets: Array<{ table: string; column: string }> = [
      { table: "tasks", column: "project_id" },
      { table: "discovery_requests", column: "project_id" },
      { table: "discovery_tracks", column: "project_id" },
      { table: "calendar_events", column: "related_project_id" },
    ];

    for (const target of cleanupTargets) {
      const { error: cleanupError } = await supabase
        .from(target.table)
        .delete()
        .eq(target.column, projectId);

      if (
        cleanupError &&
        cleanupError.code !== "PGRST205" /* table missing: skip */
      ) {
        console.error(`Delete ${target.table} failed:`, cleanupError);
        return NextResponse.json(
          { error: "Impossibile eliminare il project" },
          { status: 500 }
        );
      }
    }

    const { error: deleteVersionsError } = await supabase
      .from("project_versions")
      .delete()
      .eq("project_id", projectId);

    if (deleteVersionsError) {
      console.error("Delete project versions failed:", deleteVersionsError);
      return NextResponse.json(
        { error: "Impossibile eliminare le versioni" },
        { status: 500 }
      );
    }

    const { error: deleteProjectError } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (deleteProjectError) {
      console.error("Delete project failed:", deleteProjectError);
      return NextResponse.json(
        { error: "Impossibile eliminare il project" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Unexpected error in delete-project:", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
