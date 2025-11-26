import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BATCH_LIMIT = 50;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEKKIN_CRON_SECRET = process.env.TEKKIN_CRON_SECRET;

type QueueRow = {
  id: number;
  artist_id: string;
};

type SpotifyArtist = {
  id: string;
  followers?: { total?: number };
  popularity?: number;
};

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin config missing");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getSpotifyAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify client id/secret missing");
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error("Spotify token error: " + text);
  }

  const json = (await tokenRes.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };

  return json.access_token;
}

async function fetchSpotifyArtist(
  spotifyId: string,
  accessToken: string
): Promise<SpotifyArtist> {
  const res = await fetch(`https://api.spotify.com/v1/artists/${spotifyId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`Spotify artist error: ${res.status} ${text}`);
    (error as any).status = res.status;
    throw error;
  }

  return (await res.json()) as SpotifyArtist;
}

export async function POST(req: Request) {
  try {
    if (req.headers.get("x-tekkin-cron") !== TEKKIN_CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data: queueRows, error: queueErr } = await supabase
      .from("artist_sync_queue")
      .select("id, artist_id")
      .eq("status", "pending")
      .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`)
      .order("priority", { ascending: true })
      .order("next_run_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (queueErr) {
      console.error("Queue read error", queueErr);
      return NextResponse.json({ error: "Failed to read queue" }, { status: 500 });
    }

    if (!queueRows || queueRows.length === 0) {
      return NextResponse.json({ processed: 0, success: 0, error: 0, errors: [] });
    }

    let processed = 0;
    let success = 0;
    let error = 0;
    const errors: { artist_id: string; error: string }[] = [];
    let spotifyAccessToken: string | null = null;

    for (const row of queueRows as QueueRow[]) {
      const queueId = row.id;
      const artistId = row.artist_id;

      try {
        await supabase
          .from("artist_sync_queue")
          .update({
            status: "running",
            last_run_at: new Date().toISOString(),
          })
          .eq("id", queueId);

        const { data: artist, error: artistErr } = await supabase
          .from("artists")
          .select("id, spotify_id")
          .eq("id", artistId)
          .single();

        if (artistErr || !artist || !artist.spotify_id) {
          throw new Error("Artist not found or spotify_id missing");
        }

        if (!spotifyAccessToken) {
          spotifyAccessToken = await getSpotifyAccessToken();
        }

        let spotifyArtist: SpotifyArtist | null = null;
        try {
          spotifyArtist = await fetchSpotifyArtist(artist.spotify_id, spotifyAccessToken);
        } catch (err: any) {
          if (err?.status === 401) {
            spotifyAccessToken = await getSpotifyAccessToken();
            spotifyArtist = await fetchSpotifyArtist(artist.spotify_id, spotifyAccessToken);
          } else {
            throw err;
          }
        }

        const collectedAt = new Date().toISOString();
        const metricsPayload = {
          artist_id: artistId,
          collected_at: collectedAt,
          spotify_followers: spotifyArtist.followers?.total ?? null,
          spotify_popularity:
            typeof spotifyArtist.popularity === "number" ? spotifyArtist.popularity : null,
          spotify_monthly_listeners: null,
          spotify_streams_total: null,
          spotify_streams_change: null,
          beatport_charts: null,
          beatport_hype_charts: null,
          shows_last_90_days: null,
          shows_total: null,
        };

        const { error: insertErr } = await supabase
          .from("artist_metrics_daily")
          .insert(metricsPayload);

        if (insertErr) {
          throw insertErr;
        }

        const { error: rankErr } = await supabase.rpc("recalculate_artist_rank", {
          p_artist_id: artistId,
        });

        if (rankErr) {
          console.warn("recalculate_artist_rank failed", rankErr);
        }

        await supabase
          .from("artist_sync_queue")
          .update({
            status: "done",
            last_error: null,
            next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", queueId);

        success += 1;
        processed += 1;
      } catch (err: any) {
        console.error("Error syncing artist", artistId, err);
        error += 1;
        processed += 1;

        const message = err?.message || "Unknown error";
        errors.push({ artist_id: artistId, error: message });

        await supabase
          .from("artist_sync_queue")
          .update({
            status: "error",
            last_error: message,
            next_run_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          })
          .eq("id", queueId);
      }
    }

    return NextResponse.json({ processed, success, error, errors });
  } catch (err: any) {
    console.error("Sync artists fatal error", err);
    return NextResponse.json(
      { error: err?.message || "Fatal error during sync" },
      { status: 500 }
    );
  }
}
