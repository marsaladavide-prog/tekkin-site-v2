import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase } from "@/app/api/projects/helpers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024;
const COVER_BUCKET_NAME = "project_covers";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "FormData mancante" },
        { status: 400 }
      );
    }

    const projectId = String(formData.get("project_id") ?? "").trim();
    const file = formData.get("file");

    if (!projectId || !file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "project_id o file immagine mancanti" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Il file deve essere un'immagine" },
        { status: 400 }
      );
    }

    if (file.size > MAX_COVER_SIZE_BYTES) {
      return NextResponse.json(
        {
          error:
            "Immagine troppo grande. Limite massimo: 5 MB. Comprimi oppure usa un JPG/P"
            + "NG leggero.",
        },
        { status: 413 }
      );
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) {
      console.error("[upload-cover] fetch project error:", projectError);
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

    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: "Accesso negato" },
        { status: 403 }
      );
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("[upload-cover] missing storage config");
      return NextResponse.json(
        { error: "Impossibile risalire alla configurazione dello storage" },
        { status: 500 }
      );
    }

    const storageClient = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalName = file.name || `cover-${Date.now()}`;
    const ext =
      originalName.includes(".")
        ? originalName.split(".").pop()
        : file.type.split("/").pop();
    const safeExt = (ext ?? "jpg")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase()
      .slice(0, 8);
    const safeUserId = user.id;
    const filePath = `covers/${safeUserId}/${projectId}/cover.${safeExt || "jpg"}`;

    const { error: uploadError } = await storageClient.storage
      .from(COVER_BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[upload-cover] storage error:", uploadError);
      return NextResponse.json(
        { error: "Errore caricamento immagine" },
        { status: 500 }
      );
    }

    const { data: publicData } = storageClient.storage
      .from(COVER_BUCKET_NAME)
      .getPublicUrl(filePath);
    const coverUrl = publicData?.publicUrl ?? null;

    if (!coverUrl) {
      console.warn(
        "[upload-cover] unable to resolve public url for cover",
        filePath
      );
    }

    const { data: updatedProject, error: updateError } = await supabase
      .from("projects")
      .update({ cover_url: coverUrl, cover_path: filePath })
      .eq("id", projectId)
      .select("cover_url, cover_path")
      .maybeSingle();

    if (updateError) {
      console.error("[upload-cover] update project error:", updateError);
      return NextResponse.json(
        { error: "Impossibile aggiornare il project" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { cover_url: updatedProject?.cover_url ?? coverUrl },
      { status: 200 }
    );
  } catch (err) {
    console.error("[upload-cover] unexpected error:", err);
    return NextResponse.json(
      { error: "Errore inatteso" },
      { status: 500 }
    );
  }
}
