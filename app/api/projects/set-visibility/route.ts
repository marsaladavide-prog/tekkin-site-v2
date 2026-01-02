import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type Body = {
  project_id?: string;
  visibility?: "public" | "private_with_secret_link";
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
    const projectId = typeof body?.project_id === "string" ? body.project_id : null;
    const visibility = body?.visibility;

    if (!projectId || (visibility !== "public" && visibility !== "private_with_secret_link")) {
      return NextResponse.json({ error: "Payload non valido" }, { status: 400 });
    }

    // 1) Ownership project
    const { data: proj, error: projErr } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr) {
      console.error("[set-visibility] project read error:", projErr);
      return NextResponse.json({ error: "Errore lettura progetto" }, { status: 500 });
    }

    let isCollaborator = false;
    if (proj && proj.user_id !== user.id) {
      const { data: collabRow, error: collabErr } = await supabase
        .from("project_collaborators")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (collabErr) {
        console.error("[set-visibility] collaborator check error:", collabErr);
      }

      isCollaborator = Boolean(collabRow?.user_id);
    }

    if (!proj || (proj.user_id !== user.id && !isCollaborator)) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    // 2) PRIVATE: metti private TUTTE le versioni del project (comportamento attuale)
    if (visibility === "private_with_secret_link") {
      const { error: setAllPrivErr } = await supabase
        .from("project_versions")
        .update({ visibility: "private_with_secret_link" })
        .eq("project_id", projectId);

      if (setAllPrivErr) {
        console.error("[set-visibility] set all private error:", setAllPrivErr);
        return NextResponse.json({ error: "Impossibile aggiornare visibilità" }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    // 3) PUBLIC: deve esistere una versione publishable (analizzata + audio)
    const { data: publishable, error: pubErr } = await supabase
      .from("project_versions")
      .select("id, created_at, overall_score, audio_path, audio_url")
      .eq("project_id", projectId)
      .not("overall_score", "is", null)
      .or("audio_path.not.is.null,audio_url.not.is.null")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pubErr) {
      console.error("[set-visibility] publishable check error:", pubErr);
      return NextResponse.json({ error: "Errore verifica publishable" }, { status: 500 });
    }

    if (!publishable?.id) {
      return NextResponse.json(
        { error: "Non analizzata. Analizza una versione prima di pubblicare." },
        { status: 409 }
      );
    }

    // 4) Blindatura: una sola public per project (prima tutte private)
    const { error: allPrivErr } = await supabase
      .from("project_versions")
      .update({ visibility: "private_with_secret_link" })
      .eq("project_id", projectId);

    if (allPrivErr) {
      console.error("[set-visibility] make all private error:", allPrivErr);
      return NextResponse.json({ error: "Impossibile aggiornare visibilità" }, { status: 500 });
    }

    // 5) Set public sulla publishable, passando dalla RPC (blocca premaster)
    const { error: rpcErr } = await supabase.rpc("tekkin_set_publishable_visibility_v1", {
      p_project_id: projectId,
      p_visibility: "public",
    });

    if (rpcErr) {
      const msg = `${rpcErr.message ?? ""} ${rpcErr.details ?? ""}`.toLowerCase();
      const isPremasterBlock = msg.includes("solo versioni master");

      console.error("[set-visibility] rpc error:", rpcErr);

      return NextResponse.json(
        {
          error: isPremasterBlock
            ? "Puoi pubblicare solo versioni master"
            : "Impossibile pubblicare",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[set-visibility] unexpected:", e);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
