import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TEKKIN_MIX_TYPES, TekkinMixType } from "@/lib/constants/genres";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const DEFAULT_MIX_TYPE: TekkinMixType = "premaster";

function normalizeMixType(value?: string | null): TekkinMixType {
  if (value && TEKKIN_MIX_TYPES.includes(value as TekkinMixType)) {
    return value as TekkinMixType;
  }
  return DEFAULT_MIX_TYPE;
}

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
    const versionName =
      String(formData.get("version_name") ?? "").trim() || "v2";
    const audioFile = formData.get("file"); // IMPORTANTE: "file", non "audio"
    const mixType = normalizeMixType(formData.get("mix_type") as string | null);

    if (!projectId || !audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: "project_id o file audio mancanti" },
        { status: 400 }
      );
    }

    // limite dimensione file lato server
    if (audioFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error:
            "File troppo grande. Limite massimo server: 50 MB per file. " +
            "Usa un MP3 320 kbps per ridurre la dimensione.",
        },
        { status: 413 }
      );
    }

    // verifica che il project esista
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, mix_type")
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
      .from("tracks") // controlla che il bucket sia quello giusto
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

    // inserisco la nuova versione con il mix_type normalizzato
    const { data: newVersion, error: versionError } = await supabase
      .from("project_versions")
      .insert({
        project_id: projectId,
        version_name: versionName,
        audio_url: audioUrl,
        mix_type: mixType,
      })
      .select("id, project_id, version_name, created_at, overall_score, lufs, mix_type")
      .single();

    if (versionError || !newVersion) {
      console.error("Insert version error:", versionError);
      return NextResponse.json(
        { error: "Errore salvataggio nuova versione" },
        { status: 500 }
      );
    }

    // se questa nuova versione è un MASTER, porto il project a MASTER
    if (newVersion.mix_type === "master") {
      const { error: projectUpdateError } = await supabase
        .from("projects")
        .update({ mix_type: "master" })
        .eq("id", newVersion.project_id);

      if (projectUpdateError) {
        console.error(
          "[add-version] Failed to update project mix_type to master:",
          projectUpdateError
        );
        // qui decidi: io loggo e vado avanti, non blocco l'upload
      }
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
