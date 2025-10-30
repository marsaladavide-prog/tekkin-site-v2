import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: events } = await supabase
      .from("spotlight_events")
      .select("*")
      .order("id", { ascending: false });

    const { data: artists } = await supabase
      .from("spotlight_artists")
      .select("*");

    const parsed = events.map((e) => {
      const raw = typeof e.raw === "string" ? JSON.parse(e.raw) : e.raw;

      // Ricerca profonda del nome artista
      const artistName =
        raw?.ticketClickData?.userCreationData?.artistName ||
        raw?.artistName ||
        raw?.artist?.name ||
        raw?.performers?.[0]?.name ||
        "Unknown Artist";

      const artistData =
        artists.find(
          (a) =>
            a.name?.toLowerCase() === artistName.toLowerCase() ||
            a.alias?.toLowerCase() === artistName.toLowerCase()
        ) || null;

      return {
        id: e.id,
        artist: artistName,
        title:
          raw?.title ||
          `${artistName} Live at ${raw?.venueName || "Unknown Venue"}`,
        venue: raw?.venueName || "Unknown Venue",
        location: raw?.location || "Unknown Location",
        startsAt: raw?.startsAt,
        endsAt: raw?.endsAt,
        date: raw?.day && raw?.month && raw?.year
          ? `${raw.day} ${raw.month} ${raw.year}`
          : null,
        eventUrl:
          raw?.callToActionRedirectUrl ||
          raw?.eventUrl ||
          "https://bandsintown.com/",
        image:
          artistData?.cover_url ||
          "https://tekkin-site.vercel.app/images/default_artist.jpg",
        instagram: artistData?.instagram || null,
      };
    });

    const now = new Date();

    const live = parsed.filter(
      (e) => e.startsAt && new Date(e.startsAt) <= now && new Date(e.endsAt) >= now
    );
    const upcoming = parsed.filter(
      (e) => e.startsAt && new Date(e.startsAt) > now
    );
    const past = parsed.filter(
      (e) => e.startsAt && new Date(e.startsAt) < now && !live.includes(e)
    );

    return NextResponse.json({
      success: true,
      live,
      upcoming,
      past,
    });
  } catch (err) {
    console.error("SPOTLIGHT API ERROR:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
