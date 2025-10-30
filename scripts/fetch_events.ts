// scripts/fetch_events.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  console.log("Spotlight fetch start:", new Date().toISOString());

  // esempio: insert di test, poi sostituisci con i dati reali
  const payload = {
    artist: "Test Artist",
    track: "Test Track",
    venue: "Test Venue",
    city: "Test City",
    country: "IT",
    event_date: new Date().toISOString(),
    instagram: "https://instagram.com/test",
    image_url: null,
    source_url: "https://example.com",
  };

  const { error } = await supabase.from("spotlight_events").insert(payload);
  if (error) {
    console.error("Insert error:", error);
    process.exit(1);
  }

  const { count } = await supabase
    .from("spotlight_events")
    .select("*", { count: "exact", head: true });

  console.log("spotlight_events count:", count);
  console.log("Spotlight fetch done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
