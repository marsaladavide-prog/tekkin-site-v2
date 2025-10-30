import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BANDSINTOWN_APP_ID = "tekkin"; // il tuo app_id personale

export async function GET() {
  try {
    // 1. Prende tutti gli artisti da Supabase
    const { data: artists, error: artistError } = await supabase
      .from("spotlight_artists")
      .select("id, name");

    if (artistError) throw artistError;
    if (!artists || artists.length === 0)
      return NextResponse.json({ success: false, message: "No artists found" });

    const results: any[] = [];

    // 2. Cicla ogni artista
    for (const artist of artists) {
      const name = encodeURIComponent(artist.name);
      const url = `https://rest.bandsintown.com/artists/${name}/events?app_id=${BANDSINTOWN_APP_ID}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const events = await res.json();
      if (!Array.isArray(events) || events.length === 0) continue;

      for (const ev of events) {
        const eventData = {
          artist_id: artist.id,
          title: ev.title || `${artist.name} Live`,
          venue: ev.venue?.name || null,
          location: ev.venue
            ? `${ev.venue.city || ""}${ev.venue.country ? ", " + ev.venue.country : ""}`
            : null,
          event_date: ev.datetime ? new Date(ev.datetime).toISOString().split("T")[0] : null,
          event_url: ev.url || ev.offers?.[0]?.url || null,
          starts_at: ev.datetime ? new Date(ev.datetime).toISOString() : null,
          image_url: ev.artist?.image_url || null,
          raw: ev
        };

        // 3. Inserisce o aggiorna (evita duplicati per artist_id + event_date)
        await supabase
          .from("spotlight_events")
          .upsert(eventData, { onConflict: "artist_id,event_date" });

        results.push(eventData);
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      message: "Events updated successfully",
    });
  } catch (error: any) {
    console.error("Spotlight Update Error:", error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
