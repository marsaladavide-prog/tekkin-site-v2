import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedSupabase } from "@/app/api/projects/helpers";
import { TEKKIN_GENRES } from "@/lib/constants/genres";

export const runtime = "nodejs";

type UpdateProfileBody = {
  versionId?: string;
  profileKey?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as UpdateProfileBody | null;
  const versionId = typeof body?.versionId === "string" ? body.versionId.trim() : "";
  const profileKey = typeof body?.profileKey === "string" ? body.profileKey.trim() : "";

  if (!versionId || !profileKey) {
    return NextResponse.json(
      { error: "versionId e profileKey sono richiesti" },
      { status: 400 }
    );
  }

  const allowedKeys = new Set<string>(TEKKIN_GENRES.map((genre) => genre.id));
  if (!allowedKeys.has(profileKey)) {
    return NextResponse.json(
      { error: "Profilo Tekkin non valido" },
      { status: 400 }
    );
  }

  const { supabase, user, authError } = await getAuthenticatedSupabase();
  if (authError || !user) {
    return NextResponse.json(
      { error: "Autenticazione richiesta" },
      { status: 401 }
    );
  }

  const { data: version, error: versionError } = await supabase
    .from("project_versions")
    .select("id, project_id")
    .eq("id", versionId)
    .maybeSingle();

  if (versionError || !version) {
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

  if (projectError || !project) {
    return NextResponse.json(
      { error: "Progetto non disponibile" },
      { status: 404 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("project_versions")
    .update({ analyzer_profile_key: profileKey })
    .eq("id", versionId)
    .select("id, analyzer_profile_key")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: "Impossibile salvare il profilo Tekkin" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, profileKey: updated.analyzer_profile_key }, { status: 200 });
}
