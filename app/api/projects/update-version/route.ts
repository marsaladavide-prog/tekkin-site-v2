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
    const versionName =
      typeof body?.version_name === "string" ? body.version_name.trim() : "";

    if (!versionId || !versionName) {
      return NextResponse.json(
        { error: "version_id e version_name richiesti" },
        { status: 400 }
      );
    }

    const { data: version, error: versionError } = await supabase
      .from("project_versions")
      .select("id, project_id")
      .eq("id", versionId)
      .maybeSingle();

    if (versionError) {
      console.error("Fetch version failed:", versionError);
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

    const { data: updatedVersion, error: updateError } = await supabase
      .from("project_versions")
      .update({ version_name: versionName })
      .eq("id", versionId)
      .select("id, version_name")
      .maybeSingle();

    if (updateError) {
      console.error("Update version name failed:", updateError);
      return NextResponse.json(
        { error: "Impossibile aggiornare la versione" },
        { status: 500 }
      );
    }

    return NextResponse.json({ version: updatedVersion }, { status: 200 });
  } catch (err) {
    console.error("Unexpected error in update-version:", err);
    return NextResponse.json(
      { error: "Errore inatteso" },
      { status: 500 }
    );
  }
}
