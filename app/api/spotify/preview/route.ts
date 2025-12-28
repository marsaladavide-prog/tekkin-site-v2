import { NextRequest, NextResponse } from "next/server";

const SPOTIFY_TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

function normalizeAlbumId(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  const match = cleaned.match(/([A-Za-z0-9]{22})/);
  return match ? match[1] : null;
}

async function getSpotifyAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify client id/secret mancanti");
  }

  const tokenRes = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
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

export async function GET(req: NextRequest) {
  const albumIdParam = req.nextUrl.searchParams.get("albumId");
  const albumId = normalizeAlbumId(albumIdParam);
  if (!albumId) {
    return NextResponse.json(
      { previewUrl: null, error: "albumId mancante" },
      { status: 400 }
    );
  }
  console.log("[spotify/preview] albumId resolved", { raw: albumIdParam, normalized: albumId });

  try {
    const token = await getSpotifyAccessToken();

    const albumRes = await fetch(
      `https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}?market=US`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!albumRes.ok) {
      const text = await albumRes.text().catch(() => "");
      return NextResponse.json(
        { previewUrl: null, error: "Errore Spotify album: " + text },
        { status: albumRes.status }
      );
    }

    const album = (await albumRes.json()) as {
      tracks?: { items?: Array<{ preview_url?: string; name?: string }> };
    };
    console.log("[spotify/preview] fetched album", { albumId, tracks: album.tracks?.items?.length });

    const track =
      album.tracks?.items?.find((item) => typeof item?.preview_url === "string" && item.preview_url)
        ?? null;

      const previewUrl = track?.preview_url ?? null;
      console.log("[spotify/preview] preview result", { albumId, previewUrl });
      return NextResponse.json({
        previewUrl,
        trackName: track?.name ?? null,
      });
  } catch (err) {
    console.error("[spotify/preview] error", err);
    return NextResponse.json(
      { previewUrl: null, error: "Errore fetching preview" },
      { status: 500 }
    );
  }
}
