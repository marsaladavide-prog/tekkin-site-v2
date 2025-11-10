// scripts/fetch_events.ts
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

// === CONFIG: metti qui i tuoi link ufficiali di eventi ===
// Puoi miscelare RA / Bandsintown / Eventbrite / pagine club
// Per ogni URL indica almeno artist, city, country e starts_at.
const EVENT_URLS: Array<{
  url: string;
  artist: string;
  city: string;
  country: string;
  starts_at: string;   // ISO "2025-11-01T23:30:00Z" (metti tu l'ora)
  venue?: string;
  instagram?: string;  // @alias senza @ va bene lo stesso
}> = [
  // Esempi placeholder: METTI URL REALI QUI
  {
    url: "https://www.bandsintown.com/e/0000000000-example",
    artist: "Your DJ",
    city: "Napoli",
    country: "IT",
    starts_at: "2025-11-01T22:30:00Z",
    venue: "Duel Beat",
    instagram: "yourdj"
  },
  {
    url: "https://ra.co/events/0000000",
    artist: "Another DJ",
    city: "Roma",
    country: "IT",
    starts_at: "2025-11-07T23:00:00Z",
    venue: "Goa Club",
    instagram: "anotherdj"
  },
];

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function normIg(u?: string | null) {
  if (!u) return null;
  return u.replace(/^@/, "");
}

async function scrapeMeta(url: string) {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  const meta = await page.evaluate(() => {
    const read = (sel: string, attr = "content") =>
      (document.querySelector(sel) as HTMLMetaElement | null)?.getAttribute(attr) || null;

    const ogTitle = read('meta[property="og:title"]') || document.title || null;
    const ogImage = read('meta[property="og:image"]');
    const ogUrl = read('meta[property="og:url"]');
    const desc =
      read('meta[name="description"]') || read('meta[property="og:description"]');

    // prova anche a prendere un venue dal DOM comune
    const maybeVenue =
      (document.querySelector('[data-test="venue-name"], .venue, .VenueName')?.textContent || "")
        .trim() || null;

    return { ogTitle, ogImage, ogUrl, desc, maybeVenue };
  });

  await browser.close();
  return meta;
}

function dedupeKey(sourceUrl: string, artist: string, starts_at: string) {
  return `${sourceUrl}|${artist}|${starts_at}`.toLowerCase();
}

async function upsertEventFromUrl(e: (typeof EVENT_URLS)[number]) {
  const meta = await scrapeMeta(e.url);
  const image_url = meta.ogImage || null;
  const title = meta.ogTitle || `${e.artist} at ${e.venue || ""}`.trim();
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
    // opzionale: chiave per evitare duplicati
    dedupe_key: dedupeKey(e.url, e.artist, e.starts_at),
  };

  // assicurati di avere la colonna dedupe_key (vedi SQL sotto)
  const { data, error } = await supabase
    .from("spotlight_events")
    .upsert(row, { onConflict: "dedupe_key" })
    .select("id")
    .limit(1)
    .single();

  if (error) {
    console.error("❌ insert/upsert error:", error.message);
    return null;
  }
  console.log("✅ upserted event:", data?.id, "-", row.title);
  return data?.id as string | null;
}

async function createPlaceholderStory(event_id: string, artist: string, city: string, instagram?: string | null) {
  const payload = {
    event_id,
    ig_username: instagram || artist,
    media_url: "https://placehold.co/600x900?text=Story+Placeholder",
    thumb_url: "https://placehold.co/200x300?text=Story",
    taken_at: new Date().toISOString(),
    caption: `Live in ${city}. Tag: #${artist.replace(/\s+/g, "")}`,
    location_tag: city,
    dj_mentioned: instagram ? [instagram] : [],
    source: "placeholder"
  };

  const { error } = await supabase.from("spotlight_stories").insert(payload);
  if (error) console.error("⚠️ story insert error:", error.message);
  else console.log("📸 added placeholder story for", artist);
}

async function main() {
  console.log("Tekkin Spotlight official ingest start:", new Date().toISOString());
  let inserted = 0;

  for (const e of EVENT_URLS) {
    try {
      const id = await upsertEventFromUrl(e);
      if (id) {
        inserted++;
        // aggiungi subito una story fittizia (finché non colleghiamo IG)
        await createPlaceholderStory(id, e.artist, e.city, normIg(e.instagram || null));
      }
    } catch (err: any) {
      console.error("fetch error for", e.url, err?.message || err);
    }
  }

  console.log("Done. Events processed:", inserted);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
