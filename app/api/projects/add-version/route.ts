import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TEKKIN_MIX_TYPES, TekkinMixType } from "@/lib/constants/genres";

export const runtime = "nodejs";

const DEFAULT_MIX_TYPE: TekkinMixType = "premaster";

function normalizeMixType(value?: string | null): TekkinMixType {
  if (value && TEKKIN_MIX_TYPES.includes(value as TekkinMixType)) return value as TekkinMixType;
  return DEFAULT_MIX_TYPE;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Usa upload diretto a Storage (JSON)." }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as {
      project_id?: string;
      version_name?: string | null;
      mix_type?: string | null;
      audio_path?: string | null;
    } | null;

    console.log("[add-version] body.version_name =", body?.version_name);

    const projectId = typeof body?.project_id === "string" ? body.project_id.trim() : "";
    const versionNameRaw =
      typeof body?.version_name === "string" ? body.version_name.trim() : "";

    const versionName =
      versionNameRaw.length > 0
        ? versionNameRaw
        : `Upload ${new Date().toISOString().slice(0, 19).replace("T", " ").replace(/:/g, "-")}`;
    const mixType = normalizeMixType(body?.mix_type ?? null);

    const rawAudioPath = typeof body?.audio_path === "string" ? body.audio_path.trim() : "";
    const audioPath = rawAudioPath.replace(/^\/?tracks\//, "");

    if (!projectId) return NextResponse.json({ error: "project_id mancante" }, { status: 400 });
    if (!audioPath) return NextResponse.json({ error: "audio_path mancante" }, { status: 400 });

    // check esistenza project (solo id)
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) return NextResponse.json({ error: "Errore verificando il project" }, { status: 500 });
    if (!project) return NextResponse.json({ error: "Project non trovato" }, { status: 404 });

    console.log("[add-version] payload:", {
      projectId,
      versionName,
      audioPath,
      mixType,
    });

    const { data: newVersion, error: versionError } = await supabase
      .from("project_versions")
      .insert({
        project_id: projectId,
        version_name: versionName || `Upload ${new Date().toISOString().slice(0, 19).replace("T", " ").replace(/:/g, "-")}`,
        audio_path: audioPath,
        audio_url: null,
        mix_type: mixType,
      })
      .select("id, project_id, version_name, created_at, overall_score, lufs, mix_type, audio_path, audio_url")
      .single();

    if (versionError) {
      console.error("[add-version] insert error:", versionError);
      return NextResponse.json({ error: "Errore creando la versione" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, version: newVersion }, { status: 200 });
  } catch (err) {
    console.error("Unexpected add-version error:", err);
    return NextResponse.json({ error: "Errore inatteso add-version" }, { status: 500 });
  }
}
