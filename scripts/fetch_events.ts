// scripts/fetch_events.ts
import { createClient } from "@supabase/supabase-js";

// Config eventi di riferimento
const EVENT_URLS: Array<{
  url: string;
  artist: string;
  city: string;
  country: string;
  starts_at: string;
  venue?: string;
  instagram?: string;
}> = [
  {
    url: "https://www.bandsintown.com/e/0000000000-example",
    artist: "Your DJ",
    city: "Napoli",
    country: "IT",
    starts_at: "2025-11-01T22:30:00Z",
    venue: "Duel Beat",
    instagram: "yourdj",
  },
  {
    url: "https://ra.co/events/0000000",
    artist: "Another DJ",
    city: "Roma",
    country: "IT",
    starts_at: "2025-11-07T23:00:00Z",
    venue: "Goa Club",
    instagram: "anotherdj",
  },
];

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function normIg(u?: string | null) {
  if (!u) return null;
  return u.replace(/^@/, "");
}

// fetch con timeout, così non resta mai appeso
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// helper per leggere meta tag dall HTML
function readMetaProperty(html: string, prop: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  return m?.[1] || null;
}

function readMetaName(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  return m?.[1] || null;
}

function readTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1]?.trim() || null;
}

type ScrapedMeta = {
  ogTitle: string | null;
  ogImage: string | null;
  ogUrl: string | null;
  desc: string | null;
  maybeVenue: string | null;
};

async function scrapeMeta(url: string): Promise<ScrapedMeta> {
  try {
    const html = await fetchWithTimeout(url, 30000); // 30 secondi

    const ogTitle =
      readMetaProperty(html, "og:title") || readTitle(html) || null;
    const ogImage = readMetaProperty(html, "og:image");
    const ogUrl = readMetaProperty(html, "og:url");
    const desc =
      readMetaName(html, "description") ||
      readMetaProperty(html, "og:description");

    // tentativo grezzo per venue
    const venueMatch =
      html.match(
        /(venue|club|location)[^<]{0,50}<[^>]*>([^<]{3,80})<\/[^>]*>/i
      ) || html.match(/Venue:\s*([^<\n]{3,80})/i);
    const maybeVenue = venueMatch?.[2]?.trim() || venueMatch?.[1]?.trim() || null;

    return { ogTitle, ogImage, ogUrl, desc: desc || null, maybeVenue };
  } catch (err: any) {
    console.error("⚠️ scrapeMeta error for", url, "-", err?.message || err);
    return {
      ogTitle: null,
      ogImage: null,
      ogUrl: null,
      desc: null,
      maybeVenue: null,
    };
  }
}

function dedupeKey(sourceUrl: string, artist: string, starts_at: string) {
  return `${sourceUrl}|${artist}|${starts_at}`.toLowerCase();
}

async function upsertEventFromUrl(e: (typeof EVENT_URLS)[number]) {
  const meta = await scrapeMeta(e.url);

  const image_url = meta.ogImage || null;
  const title = meta.ogTitle || `${e.artist}${e.venue ? " at " + e.venue : ""}`;
  const venue = e.venue || meta.maybeVenue || null;

  const row = {
    artist: e.artist,
    title,
    track: null as string | null,
    venue,
    city: e.city,
    country: e.country,
    location: [e.city, e.country].filter(Boolean).join(", "),
    event_date: e.starts_at.split("T")[0],
    starts_at: e.starts_at,
    image_url,
    event_url: e.url,
    source_url: e.url,
    instagram: normIg(e.instagram),
    raw: { meta },
    dedupe_key: dedupeKey(e.url, e.artist, e.starts_at),
  };

  const { data, error } = await supabase
    .from("spotlight_events")
    .upsert(row, { onConflict: "dedupe_key" })
    .select("id")
    .limit(1)
    .single();

  if (error) {
    console.error("❌ upsert error:", error.message);
    return null;
  }

  console.log("✅ upserted event:", data?.id, "-", row.title);
  return data?.id as string | null;
}

async function createPlaceholderStory(
  event_id: string,
  artist: string,
  city: string,
  instagram?: string | null
) {
  const payload = {
    event_id,
    ig_username: instagram || artist,
    media_url: "https://placehold.co/600x900?text=Story+Placeholder",
    thumb_url: "https://placehold.co/200x300?text=Story",
    taken_at: new Date().toISOString(),
    caption: `Live in ${city}. Tag: #${artist.replace(/\s+/g, "")}`,
    location_tag: city,
    dj_mentioned: instagram ? [instagram] : [],
    source: "placeholder",
  };

  const { error } = await supabase.from("spotlight_stories").insert(payload);
  if (error) {
    console.error("⚠️ story insert error:", error.message);
  } else {
    console.log("📸 added placeholder story for", artist);
  }
}

async function main() {
  console.log("Tekkin Spotlight ingest start:", new Date().toISOString());

  let processed = 0;

  for (const e of EVENT_URLS) {
    try {
      const id = await upsertEventFromUrl(e);
      if (id) {
        processed++;
        await createPlaceholderStory(
          id,
          e.artist,
          e.city,
          normIg(e.instagram || null)
        );
      }
    } catch (err: any) {
      console.error("fetch error for", e.url, err?.message || err);
    }
  }

  console.log("Done. Events processed:", processed);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal error in main:", e);
  process.exit(1);
});
