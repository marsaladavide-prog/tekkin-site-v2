import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const versionId = typeof body?.version_id === "string" ? body.version_id : null;

  if (!versionId) {
    return NextResponse.json({ error: "version_id missing" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("tekkin_toggle_like_v1", {
    p_version_id: versionId,
  });

  if (error) {
    console.error("[toggle-like] rpc error:", error);
    return NextResponse.json(
      { error: error.message, code: (error as any).code, details: (error as any).details },
      { status: 500 }
    );
  }

  return NextResponse.json(data?.[0] ?? null);
}
