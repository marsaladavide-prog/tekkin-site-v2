import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { TEKKIN_MIX_TYPES, TekkinMixType } from "@/lib/constants/genres";

export const runtime = "nodejs";

const DEFAULT_MIX_TYPE: TekkinMixType = "premaster";

function normalizeMixType(value?: string | null): TekkinMixType {
  if (value && TEKKIN_MIX_TYPES.includes(value as TekkinMixType)) return value as TekkinMixType;
  return DEFAULT_MIX_TYPE;
}

type AddVersionJsonBody = {
  project_id: string;
  version_name?: string;
  mix_type?: string | null;
  audio_path: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Usa upload diretto a Storage (JSON)." },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => null)) as AddVersionJsonBody | null;
    if (!body) return NextResponse.json({ error: "Body JSON mancante" }, { status: 400 });

    const projectId = String(body.project_id ?? "").trim();
    const versionName = String(body.version_name ?? "").trim() || "v2";
    const mixType = normalizeMixType(body.mix_type ?? null);
    const audioPath = String(body.audio_path ?? "").trim();

    if (!projectId || !audioPath) {
      return NextResponse.json({ error: "project_id o audio_path mancanti" }, { status: 400 });
    }

    if (!audioPath.startsWith(`${projectId}/`) || audioPath.includes("..")) {
      return NextResponse.json({ error: "audio_path non valido" }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, mix_type")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project non trovato" }, { status: 404 });
    }

    const { data: newVersion, error: versionError } = await supabase
      .from("project_versions")
      .insert({
        project_id: projectId,
        version_name: versionName,
        audio_path: audioPath,
        audio_url: audioPath,
        mix_type: mixType,
      })
      .select("id, project_id, version_name, created_at, overall_score, lufs, mix_type, audio_path, audio_url")
      .single();

if (versionError || !newVersion) {
  console.error("[add-version] insert error:", versionError);
  return NextResponse.json(
    {
      error: "Errore salvataggio nuova versione",
      detail: versionError?.message ?? null,
      code: (versionError as any)?.code ?? null,
      hint: (versionError as any)?.hint ?? null,
      details: (versionError as any)?.details ?? null,
    },
    { status: 500 }
  );
}


    if (newVersion.mix_type === "master") {
      await supabase.from("projects").update({ mix_type: "master" }).eq("id", newVersion.project_id);
    }

    return NextResponse.json({ ok: true, version: newVersion }, { status: 201 });
  } catch (err) {
    console.error("Unexpected add-version error:", err);
    return NextResponse.json({ error: "Errore inatteso add-version" }, { status: 500 });
  }
}
