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
    const projectId = String(body?.project_id ?? body?.id ?? "").trim();
    const title = typeof body?.title === "string" ? body.title.trim() : "";

    if (!projectId || !title) {
      return NextResponse.json(
        { error: "project_id e title sono richiesti" },
        { status: 400 }
      );
    }

    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch project for update failed:", fetchError);
      return NextResponse.json(
        { error: "Errore nel recupero del project" },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json(
        { error: "Project non trovato" },
        { status: 404 }
      );
    }

    const { data: updatedProject, error: updateError } = await supabase
      .from("projects")
      .update({ title })
      .eq("id", projectId)
      .select("id, title")
      .maybeSingle();

    if (updateError) {
      console.error("Update project title failed:", updateError);
      return NextResponse.json(
        { error: "Impossibile aggiornare il project" },
        { status: 500 }
      );
    }

    return NextResponse.json({ project: updatedProject }, { status: 200 });
  } catch (err) {
    console.error("Unexpected error in update-project:", err);
    return NextResponse.json(
      { error: "Errore inatteso" },
      { status: 500 }
    );
  }
}
