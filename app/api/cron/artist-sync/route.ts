// app/api/cron/artist-sync/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/client";

const BATCH_LIMIT = 50;

export async function POST(req: Request) {
  const headerSecret = req.headers.get("x-tekkin-cron");
  if (headerSecret !== process.env.TEKKIN_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();

  try {
    const { data: queueRows, error: queueErr } = await supabase
      .from("artist_sync_queue")
      .select("id, artist_id, status")
      .eq("status", "pending")
      .lte("next_run_at", new Date().toISOString())
      .order("priority", { ascending: true })
      .order("next_run_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (queueErr) {
      console.error("Queue read error", queueErr);
      return NextResponse.json(
        { error: "Failed to read queue" },
        { status: 500 }
      );
    }

    if (!queueRows || queueRows.length === 0) {
      return NextResponse.json({ processed: 0, message: "No pending jobs" });
    }

    let processed = 0;
    const errors: any[] = [];

    for (const row of queueRows) {
      const queueId = row.id;
      const artistId = row.artist_id as string;

      try {
        await supabase
          .from("artist_sync_queue")
          .update({
            status: "running",
            last_run_at: new Date().toISOString(),
          })
          .eq("id", queueId);

        // MOCK DATI (poi ci metti le API vere)
        const random = Math.random();
        const metrics = {
          spotify_monthly_listeners: Math.floor(10_000 + random * 40_000),
          spotify_streams_total: Math.floor(20_000 + random * 80_000),
          spotify_streams_change: 10 + random * 10,
          beatport_charts: Math.random() > 0.5 ? 2 : 0,
          beatport_hype_charts: Math.random() > 0.8 ? 1 : 0,
          shows_last_90_days: Math.floor(random * 20),
          shows_total: Math.floor(50 + random * 200),
        };

        const { error: metricsErr } = await supabase
          .from("artist_metrics_daily")
          .insert({
            artist_id: artistId,
            ...metrics,
          });

        if (metricsErr) throw metricsErr;

        const { error: rankErr } = await supabase.rpc(
          "recalculate_artist_rank",
          { p_artist_id: artistId }
        );

        if (rankErr) throw rankErr;

        await supabase
          .from("artist_sync_queue")
          .update({
            status: "done",
            last_error: null,
            next_run_at: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
          })
          .eq("id", queueId);

        processed += 1;
      } catch (err: any) {
        console.error("Error syncing artist", artistId, err);

        errors.push({
          artist_id: artistId,
          error: err.message || String(err),
        });

        await supabase
          .from("artist_sync_queue")
          .update({
            status: "error",
            last_error: err.message || "Unknown error",
            next_run_at: new Date(
              Date.now() + 6 * 60 * 60 * 1000
            ).toISOString(),
          })
          .eq("id", queueId);
      }
    }

    return NextResponse.json({ processed, errors });
  } catch (err: any) {
    console.error("Sync artists fatal error", err);
    return NextResponse.json(
      { error: "Fatal error during sync" },
      { status: 500 }
    );
  }
}
