export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdmin } from "@/app/api/artist/profile";

type ScanBody = {
  url?: string;
};

type SpotifyArtist = {
  id: string;
  name: string;
  genres: string[];
  external_urls?: { spotify?: string };
  followers?: { total?: number };
  popularity?: number;
  images?: { url: string; height?: number; width?: number }[];
};


type BeatstatsSummary = {
  url: string;
  currentPositionsText?: string;
};

type ArtistData = {
  name: string;
  genre: string;
  imageUrl: string;
  instagram: string;
  beatport: string | null;
  soundcloud: string;
  traxsource?: string | null;
  songstats?: string | null;
  residentAdvisor?: string | null;
  songkick?: string | null;
  appleMusic?: string | null;
  tidal?: string | null;
  spotifyId?: string | null;
  spotifyFollowers?: number | null;
  spotifyPopularity?: number | null;
  spotify_url?: string | null;
  spotify_id?: string | null;
  beatstatsUrl?: string | null;
  beatstatsCurrentPositions?: string | null;
  spotifyReleases?: {
    id: string;
    title: string;
    releaseDate: string;
    coverUrl: string | null;
    spotifyUrl: string | null;
    albumType: string | null;
  }[];
};

async function findBeatstatsUrlByName(
  artistName: string
): Promise<string | null> {
  try {
    const searchUrl = `https://www.beatstats.com/search/search/index?q=${encodeURIComponent(
      artistName
    )}`;

    const res = await fetch(searchUrl, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      console.error("[Beatstats] search request failed", res.status);
      return null;
    }

    const html = await res.text();

    const patterns: RegExp[] = [
      /href=['"](\/artist\/[^'"]*?\/\d+)['"]/i,
      /(\/artist\/[a-z0-9-]+\/\d+)/i,
    ];

    for (const regex of patterns) {
      const match = html.match(regex);
      if (match && match[1]) {
        const relative = match[1];
        return `https://www.beatstats.com${relative}`;
      }
    }

    console.warn(
      "[Beatstats] Nessun link artista trovato nella pagina di ricerca"
    );
    return null;
  } catch (err) {
    console.error("[Beatstats] errore findBeatstatsUrlByName", err);
    return null;
  }
}

async function fetchBeatstatsSummary(
  beatstatsUrl: string
): Promise<BeatstatsSummary | null> {
  try {
    const res = await fetch(beatstatsUrl, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      console.error("[Beatstats] fetch artist page failed", res.status);
      return null;
    }

    const html = await res.text();

    let currentPositionsText: string | undefined;
    const idx = html.indexOf("CURRENT ARTIST CHART POSITIONS");
    if (idx !== -1) {
      const snippet = html.slice(idx, idx + 600);
      currentPositionsText = snippet
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    return {
      url: beatstatsUrl,
      currentPositionsText,
    };
  } catch (err) {
    console.error("[Beatstats] errore fetchBeatstatsSummary", err);
    return null;
  }
}

function extractSpotifyId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("spotify.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("artist");
    if (idx === -1 || !parts[idx + 1]) return null;
    const rawId = parts[idx + 1];
    return rawId.split("?")[0];
  } catch {
    return null;
  }
}

async function getSpotifyAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify client id/secret mancanti");
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
    throw new Error("Errore Spotify token: " + text);
  }

  const json = (await tokenRes.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };

  return json.access_token;
}

async function fetchSpotifyArtist(
  artistId: string,
  accessToken: string
): Promise<SpotifyArtist> {
  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("Errore Spotify artist: " + text);
  }

  return (await res.json()) as SpotifyArtist;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ScanBody;

  if (!body.url || !body.url.trim()) {
    return NextResponse.json({ error: "Nessun URL fornito" }, { status: 400 });
  }

  const url = body.url.trim();
  const spotifyId = extractSpotifyId(url);

  if (!spotifyId) {
    return NextResponse.json(
      {
        error: "Per ora supportiamo solo link artista Spotify",
        logs: [
          "> Avvio scansione profilo...",
          `> URL sorgente: ${body.url}`,
          "> Formato non supportato. Usa un link artista Spotify.",
        ],
      },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) {
      console.error("[scan-artist] supabase auth error:", authError);
    }
    const userId = user?.id ?? null;

    const accessToken = await getSpotifyAccessToken();
    const spotifyArtist = await fetchSpotifyArtist(spotifyId, accessToken);

    const primaryGenre =
      spotifyArtist.genres && spotifyArtist.genres.length > 0
        ? spotifyArtist.genres[0]
        : "Artist";

    const imageUrl =
      spotifyArtist.images && spotifyArtist.images.length > 0
        ? spotifyArtist.images[0].url
        : "/images/default-artist.png";

    // ===========================
    // NEW: fetch release da Spotify
    // ===========================
    let spotifyReleases: {
      id: string;
      title: string;
      releaseDate: string;
      coverUrl: string | null;
      spotifyUrl: string | null;
      albumType: string | null;
    }[] = [];

    try {
      const releasesRes = await fetch(
        `https://api.spotify.com/v1/artists/${spotifyArtist.id}/albums?include_groups=album,single,compilation,appears_on&market=US&limit=50`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!releasesRes.ok) {
        console.error(
          "[scan-artist] Spotify releases fetch error",
          releasesRes.status,
          await releasesRes.text()
        );
      } else {
        const releasesJson = await releasesRes.json();

        spotifyReleases = (releasesJson.items || []).map((alb: any) => ({
          id: alb.id,
          title: alb.name,
          releaseDate: alb.release_date,
          coverUrl: alb.images?.[0]?.url || null,
          spotifyUrl: alb.external_urls?.spotify || null,
          albumType: alb.album_type || null, // "single", "album", "compilation"
        }));
      }
    } catch (err) {
      console.error("[scan-artist] errore fetch releases Spotify", err);
    }

    const artist: ArtistData = {
      name: spotifyArtist.name,
      genre: primaryGenre,
      imageUrl,
      instagram: "",
      beatport: "",
      soundcloud: "",
      traxsource: null,
      songstats: null,
      residentAdvisor: null,
      songkick: null,
      appleMusic: null,
      tidal: null,
      spotifyId: spotifyArtist.id,
      spotify_url: url,
      spotify_id: spotifyId,
      spotifyFollowers: spotifyArtist.followers?.total ?? null,
      spotifyPopularity: spotifyArtist.popularity ?? null,
      beatstatsUrl: null,
      beatstatsCurrentPositions: null,

      // NEW: lista release per la sezione Main Releases & Highlights
      spotifyReleases,
      };

    const ENABLE_BEATSTATS = false;
    let beatstatsSummary: BeatstatsSummary | null = null;

    if (ENABLE_BEATSTATS) {
      console.log("[scan-artist] starting Beatstats search for", spotifyArtist.name);
      try {
        const beatstatsUrl = await findBeatstatsUrlByName(spotifyArtist.name);
        if (beatstatsUrl) {
          beatstatsSummary = await fetchBeatstatsSummary(beatstatsUrl);
        }
      } catch (err) {
        console.error("[Beatstats] search request failed", err);
      }
    }
    const extraLogs: string[] = [];

    if (beatstatsSummary) {
      artist.beatstatsUrl = beatstatsSummary.url;
      artist.beatstatsCurrentPositions = beatstatsSummary.currentPositionsText ?? null;
      extraLogs.push("> [BEATSTATS] Profilo artista trovato.");
    } else {
      extraLogs.push("> [BEATSTATS] Nessun profilo artista trovato.");
    }

    if (spotifyReleases.length > 0) {
      extraLogs.push(
        `> [SPOTIFY] Trovate ${spotifyReleases.length} release collegate al profilo.`
      );
    } else {
      extraLogs.push("> [SPOTIFY] Nessuna release trovata o errore nel fetch.");
    }

    // ===========================
    // Salvataggio su Supabase (profilo + metriche)
    // ===========================
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!authError && user) {
        const { data: profile, error: profileErr } = await supabase
          .from("users_profile")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profileErr && profile) {
          const profileArtistId = profile.id as string;

          const profileUpdate: Record<string, any> = {
            artist_name: artist.name,
            photo_url: artist.imageUrl,
            spotify_id: artist.spotifyId,
            spotify_url: artist.spotify_url,
          };

          const { error: profileUpdateErr } = await supabase
            .from("users_profile")
            .update(profileUpdate)
            .eq("id", profileArtistId);

          if (profileUpdateErr) {
            console.error(
              "[scan-artist] supabase profile update error",
              profileUpdateErr
            );
          }

          let adminSupabase = null;
          try {
            adminSupabase = getSupabaseAdmin();
          } catch (adminInitErr) {
            console.error(
              "[scan-artist] supabase admin init error",
              adminInitErr
            );
          }

          if (adminSupabase) {
            const artistPayload: Record<string, any> = {
              id: profileArtistId,
              user_id: userId ?? null,
              artist_name:
                artist.name || spotifyArtist.name || "Untitled artist",
              spotify_id: artist.spotifyId ?? spotifyArtist.id ?? null,
              spotify_url:
                artist.spotify_url ?? spotifyArtist.external_urls?.spotify ?? null,
              spotify_followers: artist.spotifyFollowers ?? null,
              spotify_popularity: artist.spotifyPopularity ?? null,
            };

            console.log(
              "[scan-artist] upserting artists payload",
              artistPayload
            );

            const { error: artistUpsertError } = await adminSupabase
              .from("artists")
              .upsert(artistPayload, { onConflict: "id" });

            if (artistUpsertError) {
              console.error(
                "[scan-artist] supabase ensure artist error",
                artistUpsertError
              );
              return NextResponse.json(
                {
                  error: "failed to upsert artist",
                  details: artistUpsertError,
                },
                { status: 500 }
              );
            }

            if (spotifyReleases.length > 0) {
              const releasesPayload = spotifyReleases.map((r, idx) => ({
                artist_id: profileArtistId,
                spotify_id: r.id,
                title: r.title,
                release_date: r.releaseDate ?? null,
                cover_url: r.coverUrl ?? null,
                spotify_url: r.spotifyUrl ?? null,
                album_type: r.albumType ?? null,
                position: idx,
              }));

              console.log(
                "[scan-artist] upserting spotify releases count",
                releasesPayload.length
              );

              const { error: releasesError } = await adminSupabase
                .from("artist_spotify_releases")
                .upsert(releasesPayload, {
                  onConflict: "artist_id,spotify_id",
                });

              if (releasesError) {
                console.error(
                  "[scan-artist] errore salvataggio spotify releases",
                  releasesError
                );
              }
            }

            const metricsPayload: Record<string, any> = {
              artist_id: profileArtistId,
              spotify_monthly_listeners: null,
              spotify_streams_total: null,
              spotify_streams_change: null,
              spotify_followers: spotifyArtist.followers?.total ?? null,
              spotify_popularity: spotifyArtist.popularity ?? null,
              beatport_charts: null,
              beatport_hype_charts: null,
              shows_last_90_days: null,
              shows_total: null,
            };

            const { error: metricsErr } = await adminSupabase
              .from("artist_metrics_daily")
              .insert(metricsPayload);

            if (metricsErr) {
              console.error(
                "[scan-artist] supabase metrics insert error",
                metricsErr
              );
            }
          } else {
            console.warn(
              "[scan-artist] supabase metrics insert skipped (admin client missing)"
            );
          }
        }
      }
    } catch (persistErr) {
      console.error("[scan-artist] supabase persist error", persistErr);
    }

    const logs = [
      "> Avvio scansione profilo...",
      `> URL sorgente: ${body.url}`,
      "> [SPOTIFY API] Richiesta dettagli artista...",
      "> [SPOTIFY API] Dati artista ricevuti.",
      "> Mapping dati al formato Tekkin...",
      ...extraLogs,
    ];

    return NextResponse.json({ logs, artist });
  } catch (err) {
    console.error("[scan-artist] error", err);
    return NextResponse.json(
      {
        error: "Errore durante la scansione artista",
        logs: [
          "> Avvio scansione profilo...",
          `> URL sorgente: ${body.url}`,
          "> Errore durante la chiamata a Spotify. Riprova piu tardi.",
        ],
      },
      { status: 500 }
    );
  }
}
