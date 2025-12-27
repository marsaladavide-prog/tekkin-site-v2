import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const path = (url.searchParams.get("path") ?? "").trim();
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const { data, error } = await supabase.storage.from("tracks").createSignedUrl(path, 60 * 30);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Cannot sign" }, { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl });
}
