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
    const genre = typeof body?.genre === "string" ? body.genre.trim() : "";

    if (!projectId || (!title && !genre)) {
      return NextResponse.json(
        { error: "project_id e almeno title o genre sono richiesti" },
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

    const updateData: { title?: string; genre?: string } = {};
    if (title) updateData.title = title;
    if (genre) updateData.genre = genre;

    const { data: updatedProject, error: updateError } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", projectId)
      .select("id, title, genre")
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
