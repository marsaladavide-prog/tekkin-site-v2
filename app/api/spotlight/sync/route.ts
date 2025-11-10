import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

type InBody = {
  mock?: boolean;
  artists?: string[]; // es. ["Cloonee","Jamie Jones"]
};

async function fetchBandsintownEvents(artist: string) {
  const appId = process.env.BANDSINTOWN_APP_ID;
  if (!appId) {
    return { ok: false, status: 400, reason: "missing_app_id", events: [] as any[] };
  }

  const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(
    artist
  )}/events?app_id=${encodeURIComponent(appId)}&date=all`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    return { ok: false, status: res.status, reason: "upstream_error", events: [] as any[] };
  }
  const data = await res.json();
  // Bandsintown può tornare oggetto o array a seconda dell'endpoint
  return { ok: true, status: 200, reason: "ok", events: Array.isArray(data) ? data : [] };
}

function parseEvent(e: any, artist: string) {
  // Normalizzazione minima
  const provider_event_id =
    e?.id?.toString?.() ??
    e?.eventId?.toString?.() ??
    `${artist}-${e?.datetime ?? e?.startsAt ?? crypto.randomUUID()}`;

  const event_date = e?.datetime ?? e?.startsAt ?? e?.date ?? null;

  const raw = {
    ...e,
    artist: artist ?? e?.artist ?? null,
    venue: e?.venue?.name ?? e?.venue ?? null,
    city: e?.venue?.city ?? e?.city ?? null,
    country: e?.venue?.country ?? e?.country ?? null,
    datetime: event_date,
    source: "bandsintown",
    eventUrl: e?.url ?? e?.eventUrl ?? null,
    image_url: e?.artist?.image_url ?? e?.thumbnail_url ?? null
  };

  return {
    provider: "bandsintown",
    provider_event_id,
    artist: raw.artist,
    venue: raw.venue,
    city: raw.city,
    country: raw.country,
    event_date: event_date ? new Date(event_date) : null,
    raw
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as InBody;
    const artists = body.artists?.length ? body.artists : ["Cloonee", "Jamie Jones", "Ilario Alicante"];

    const inserted: any[] = [];
    const skipped: any[] = [];
    const notes: Record<string, string> = {};
    let ok = true;
    let reason = "ok";

    if (body.mock) {
      const mock = {
        provider: "mock",
        provider_event_id: "mock-1",
        artist: "Test Artist",
        venue: "Test Venue",
        city: "Napoli",
        country: "IT",
        event_date: new Date().toISOString(),
        raw: {
          artist: "Test Artist",
          venue: "Test Venue",
          city: "Napoli",
          country: "IT",
          datetime: new Date().toISOString(),
          eventUrl: "https://example.com",
          image_url: null,
          source: "mock"
        }
      };
      const up = await supabaseAdmin.from("spotlight_events").upsert(mock, {
        onConflict: "provider,provider_event_id"
      });
      if (up.error) {
        ok = false;
        reason = up.error.message;
      } else {
        inserted.push(mock.provider_event_id);
      }
      return NextResponse.json({ ok, reason, inserted, skipped, notes });
    }

    for (const artist of artists) {
      const r = await fetchBandsintownEvents(artist);
      if (!r.ok) {
        ok = false;
        reason = "bandsintown_error";
        notes[artist] = `Upstream ${r.status}`;
        continue;
      }
      for (const ev of r.events) {
        const rec = parseEvent(ev, artist);
        const up = await supabaseAdmin.from("spotlight_events").upsert(rec, {
          onConflict: "provider,provider_event_id"
        });
        if (up.error) {
          skipped.push(rec.provider_event_id);
        } else {
          inserted.push(rec.provider_event_id);
        }
      }
    }

    return NextResponse.json({ ok, reason, inserted, skipped, notes });
  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: err?.message ?? "error" }, { status: 500 });
  }
}
