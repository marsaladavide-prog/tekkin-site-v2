import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { signTrackUrl } from "@/lib/storage/signTrackUrl";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const versionId = typeof body?.version_id === "string" ? body.version_id.trim() : "";
  if (!versionId) return NextResponse.json({ error: "version_id mancante" }, { status: 400 });

  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("project_versions")
    .select("audio_path")
    .eq("id", versionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const audioPath = data?.audio_path ?? null;
  const signedUrl = await signTrackUrl(supabaseAdmin, audioPath, 60 * 30);

  if (!signedUrl) return NextResponse.json({ error: "Impossibile firmare audio_url" }, { status: 404 });

  return NextResponse.json({ audio_url: signedUrl });
}
