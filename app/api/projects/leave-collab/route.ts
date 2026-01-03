import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type Body = {
  project_id?: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    const projectId = typeof body?.project_id === "string" && body.project_id.trim() ? body.project_id.trim() : null;

    if (!projectId) {
      return NextResponse.json({ error: "Project id mancante" }, { status: 400 });
    }

    const { data: collab, error: collabErr } = await supabase
      .from("project_collaborators")
      .select("project_id, user_id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (collabErr) {
      console.error("[leave-collab] lookup error:", collabErr);
      return NextResponse.json({ error: "Errore verificando la collaborazione" }, { status: 500 });
    }

    if (!collab) {
      return NextResponse.json({ error: "Non sei collaboratore di questo project" }, { status: 403 });
    }

    const { error: deleteErr } = await supabase
      .from("project_collaborators")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    if (deleteErr) {
      console.error("[leave-collab] delete error:", deleteErr);
      return NextResponse.json({ error: "Errore eliminando la collaborazione" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[leave-collab] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
