import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("version_ids") ?? "";
  const versionIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (versionIds.length === 0) {
    return NextResponse.json({ map: {} }, { status: 200 });
  }

  const supabase = await createClient();

  // 1) counts per version (view aggregata o tabella contatore)
  const { data: countsRows, error: countsErr } = await supabase
    .from("track_likes_counts_v1")
    .select("version_id, likes_count")
    .in("version_id", versionIds);

  if (countsErr) {
    return NextResponse.json({ error: "likes counts read failed" }, { status: 500 });
  }

  // 2) liked-by-me per user (tabella track_likes con (user_id, version_id))
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  let likedSet = new Set<string>();
  if (userId) {
    const { data: likedRows, error: likedErr } = await supabase
      .from("track_likes")
      .select("version_id")
      .eq("user_id", userId)
      .in("version_id", versionIds);

    if (likedErr) {
      return NextResponse.json({ error: "likes user read failed" }, { status: 500 });
    }

    likedSet = new Set((likedRows ?? []).map((r) => r.version_id).filter(Boolean));
  }

  const countsMap = new Map<string, number>();
  for (const r of countsRows ?? []) countsMap.set(r.version_id, Number(r.likes_count ?? 0));

  const map: Record<string, { count: number; liked: boolean }> = {};
  for (const id of versionIds) {
    map[id] = { count: countsMap.get(id) ?? 0, liked: likedSet.has(id) };
  }

  return NextResponse.json({ map }, { status: 200 });
}
