import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "FormData mancante" },
        { status: 400 }
      );
    }

    const projectId = String(formData.get("project_id") ?? "").trim();
    const versionName = String(formData.get("version_name") ?? "").trim() || "v2";
    const audioFile = formData.get("audio");

    if (!projectId || !audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "project_id o file audio mancanti" },
        { status: 400 }
      );
    }

    // verifica che il project esista
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("Project not found:", projectError);
      return NextResponse.json(
        { error: "Project non trovato" },
        { status: 404 }
      );
    }

    // upload file su storage
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const originalName = audioFile.name || "track";
    const ext = originalName.includes(".")
      ? originalName.split(".").pop()
      : "wav";

    const uniqueId = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const filePath = `${projectId}/${uniqueId}.${ext}`;

    const { data: storageData, error: uploadError } = await supabase.storage
      .from("tracks")
      .upload(filePath, buffer, {
        contentType: audioFile.type || "audio/wav",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Errore upload file audio" },
        { status: 500 }
      );
    }

    const audioUrl = storageData?.path ?? filePath;

    // inserisco nuova versione, campi analisi null
    const { data: newVersion, error: versionError } = await supabase
      .from("project_versions")
      .insert({
        project_id: projectId,
        version_name: versionName,
        audio_url: audioUrl,
      })
      .select("id, version_name, created_at, overall_score, lufs")
      .single();

    if (versionError || !newVersion) {
      console.error("Insert version error:", versionError);
      return NextResponse.json(
        { error: "Errore salvataggio nuova versione" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        version: newVersion,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Unexpected add-version error:", err);
    return NextResponse.json(
      { error: "Errore inatteso add-version" },
      { status: 500 }
    );
  }
}
