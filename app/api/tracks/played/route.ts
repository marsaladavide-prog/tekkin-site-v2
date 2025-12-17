import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { randomUUID } from "crypto";

const COOKIE_NAME = "tekkin_vid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const versionId = typeof body?.version_id === "string" ? body.version_id : null;
    if (!versionId) {
      return NextResponse.json({ error: "Missing version_id" }, { status: 400 });
    }

    const existingCookie = req.cookies.get(COOKIE_NAME);
    const viewerId = existingCookie?.value ?? randomUUID();

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("tekkin_track_play_v1", {
      p_version_id: versionId,
      p_viewer_id: viewerId,
    });

    if (error) {
      console.error("[POST /api/tracks/played] rpc error:", error);
      return NextResponse.json({ error: error.message ?? "Track play failed" }, { status: 500 });
    }

    const response = NextResponse.json(
      { inserted: Boolean(data) },
      { status: 200 }
    );

    if (!existingCookie) {
      response.cookies.set({
        name: COOKIE_NAME,
        value: viewerId,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: COOKIE_MAX_AGE,
      });
    }

    return response;
  } catch (err: any) {
    console.error("[POST /api/tracks/played] unexpected error:", err);
    return NextResponse.json(
      { error: "Unable to record play" },
      { status: 500 }
    );
  }
}
