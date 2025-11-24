import { NextResponse } from "next/server";

type ScanBody = {
  url?: string;
};

type PlatformGuesses = {
  instagram?: string;
  beatport?: string;
  traxsource?: string;
  soundcloud?: string;
  songstats?: string;
  residentAdvisor?: string;
  songkick?: string;
  appleMusic?: string;
  tidal?: string;
};

function makePrettyNameFromSlug(slug: string): string {
  const pretty =
    slug
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (c) => c.toUpperCase()) || "Artist";
  return pretty;
}

function inferHandleFromUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "artist";

    return {
      host,
      slug: last.toLowerCase(),
      pathParts: parts,
    };
  } catch {
    return {
      host: "",
      slug: "artist",
      pathParts: [] as string[],
    };
  }
}

function buildPlatformGuesses(slug: string): PlatformGuesses {
  const handle = slug.toLowerCase();

  return {
    instagram: `https://instagram.com/${handle}`,
    beatport: `https://www.beatport.com/artist/${handle}/00000`,
    traxsource: `https://www.traxsource.com/artist/000000/${handle}`,
    soundcloud: `https://soundcloud.com/${handle}`,
    songstats: `https://app.songstats.com/artist/${handle}`,
    residentAdvisor: `https://ra.co/dj/${handle}`,
    songkick: `https://www.songkick.com/artists/${handle}`,
    appleMusic: `https://music.apple.com/artist/${handle}`,
    tidal: `https://listen.tidal.com/artist/${handle}`,
  };
}

/**
 * Client Credentials flow per prendere un token app-level Spotify
 */
async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn("SPOTIFY_CLIENT_ID/SECRET mancanti nelle env");
    return null;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    console.error("Spotify token error", await res.text());
    return null;
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/**
 * Se l’URL è un profilo artista Spotify, recupera info reali
 */
async function fetchSpotifyArtist(url: string) {
  const { host, pathParts } = inferHandleFromUrl(url);

  const isSpotifyArtist =
    host.includes("spotify.com") && pathParts[0] === "artist";

  if (!isSpotifyArtist) return null;

  const artistId = pathParts[1];
  if (!artistId) return null;

  const token = await getSpotifyToken();
  if (!token) return null;

  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    console.error("Spotify artist fetch error", await res.text());
    return null;
  }

  const data = await res.json();

  return {
    id: data.id as string,
    name: data.name as string,
    genres: (data.genres as string[]) ?? [],
    imageUrl:
      (data.images?.[0]?.url as string | undefined) ??
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        data.name
      )}&background=050505&color=ffffff`,
    followers: data.followers?.total as number | undefined,
    popularity: data.popularity as number | undefined,
    externalUrls: data.external_urls as Record<string, string> | undefined,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ScanBody;
    const url = body?.url?.trim();

    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const { host, slug } = inferHandleFromUrl(url);

    let spotifyArtist: Awaited<ReturnType<typeof fetchSpotifyArtist>> | null =
      null;
    let prettyName = makePrettyNameFromSlug(slug);
    let genreLabel = "Minimal / Deep Tech";

    // 1) PROVA ad usare Spotify se l’URL è un artista Spotify
    try {
      spotifyArtist = await fetchSpotifyArtist(url);
      if (spotifyArtist) {
        prettyName = spotifyArtist.name;
        if (spotifyArtist.genres && spotifyArtist.genres.length > 0) {
          genreLabel = spotifyArtist.genres.slice(0, 2).join(" / ");
        }
      }
    } catch (e) {
      console.error("Errore fetchSpotifyArtist", e);
    }

    const guesses = buildPlatformGuesses(slug);

    const logs = [
      "> Connessione al gateway musicale...",
      `> URL rilevato: ${url}`,
      `> Host sorgente: ${host || "sconosciuto"}`,
      spotifyArtist
        ? `> [SPOTIFY API] Artista trovato: ${spotifyArtist.name}`
        : "> [SPOTIFY API] Non disponibile / fallback su handle",
      "> Analisi handle social e piattaforme correlate...",
      "> Generazione link (Instagram, Beatport, Soundcloud, ecc)...",
      "> Inizializzazione profilo artista...",
      "> IDENTITA' PREPARATA. Verifica i dati prima di procedere.",
    ];

    const artist = {
      name: prettyName,
      genre: genreLabel,
      imageUrl:
        spotifyArtist?.imageUrl ??
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          prettyName
        )}&background=050505&color=ffffff`,
      spotifyId: spotifyArtist?.id ?? null,
      spotifyFollowers: spotifyArtist?.followers ?? null,
      spotifyPopularity: spotifyArtist?.popularity ?? null,

      instagram: guesses.instagram!,
      beatport: guesses.beatport!,
      soundcloud: guesses.soundcloud!,

      traxsource: guesses.traxsource,
      songstats: guesses.songstats,
      residentAdvisor: guesses.residentAdvisor,
      songkick: guesses.songkick,
      appleMusic: guesses.appleMusic,
      tidal: guesses.tidal,
      platforms: guesses,
    };

    return NextResponse.json({ logs, artist });
  } catch (err) {
    console.error("scan-artist error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
