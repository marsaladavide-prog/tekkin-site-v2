export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("spotlight_events")
    .select("id, artist, venue, city, country, event_date, raw")
    .order("event_date", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Se il frontend si aspetta ancora "date", gli mappiamo event_date -> date
  const events = (data ?? []).map(e => ({
    ...e,
    date: e.event_date, // compat vecchia
  }));

  return NextResponse.json({ success: true, events });
}
