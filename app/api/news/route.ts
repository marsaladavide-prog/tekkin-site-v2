// /app/api/news/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const source = searchParams.get("source") || "";
  const from = parseInt(searchParams.get("from") || "0", 10);
  const to = from + parseInt(searchParams.get("limit") || "24", 10) - 1;

  const supabase = await supabaseServer();

  let query = supabase
    .from("news")
    .select("id,title,slug,url,source,category,summary,created_at,image_url", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    // ricerca semplice su title e summary
    query = query.ilike("title", `%${q}%`).or(`summary.ilike.%${q}%`);
  }
  if (category) query = query.eq("category", category);
  if (source) query = query.eq("source", source);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data, total: count ?? 0 });
}
