import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase } from "@/app/api/projects/helpers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { supabase, user, authError } = await getAuthenticatedSupabase();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Autenticazione richiesta" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const versionId = String(body?.version_id ?? "").trim();

    if (!versionId) {
      return NextResponse.json(
        { error: "version_id richiesto" },
        { status: 400 }
      );
    }

    const { data: version, error: versionError } = await supabase
      .from("project_versions")
      .select("id, project_id")
      .eq("id", versionId)
      .maybeSingle();

    if (versionError) {
      console.error("Fetch version for delete failed:", versionError);
      return NextResponse.json(
        { error: "Errore recupero versione" },
        { status: 500 }
      );
    }

    if (!version) {
      return NextResponse.json(
        { error: "Versione non trovata" },
        { status: 404 }
      );
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", version.project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (projectError) {
      console.error("Fetch parent project failed:", projectError);
      return NextResponse.json(
        { error: "Errore recupero project" },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json(
        { error: "Project non trovato" },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from("project_versions")
      .delete()
      .eq("id", versionId);

    if (deleteError) {
      console.error("Delete version failed:", deleteError);
      return NextResponse.json(
        { error: "Impossibile eliminare la versione" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Unexpected error in delete-version:", err);
    return NextResponse.json(
      { error: "Errore inatteso" },
      { status: 500 }
    );
  }
}
