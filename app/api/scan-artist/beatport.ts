const BEATPORT_TOKEN_URL = "https://api.beatport.com/v4/auth/o/token/";

type BeatportTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

export type BeatportArtistResult = {
  id: number | string;
  name: string;
  slug?: string;
  url?: string;
};

type BeatportSearchItem = {
  id: number;
  name: string;
  slug?: string;
  public_url?: string;
  uri?: string;
};

type BeatportSearchResponse = {
  results?: {
    items?: BeatportSearchItem[];
  };
};

export async function getBeatportAccessToken(): Promise<string> {
  const apiKey = process.env.BEATPORT_API_KEY;
  if (apiKey) {
    return `Bearer ${apiKey}`;
  }

  const clientId = process.env.BEATPORT_CLIENT_ID;
  const clientSecret = process.env.BEATPORT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("BEATPORT_CLIENT_ID / BEATPORT_CLIENT_SECRET mancanti");
  }

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("grant_type", "client_credentials");

  const res = await fetch(BEATPORT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Beatport token request failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as BeatportTokenResponse;

  if (!json.access_token) {
    throw new Error("Beatport token response senza access_token");
  }

  return `${json.token_type ?? "Bearer"} ${json.access_token}`;
}

function buildHeaders(token: string): Record<string, string> {
  const isPrefixed =
    token.startsWith("Bearer ") || token.startsWith("Basic ");
  return {
    Accept: "application/json",
    Authorization: isPrefixed ? token : `Bearer ${token}`,
  };
}

export async function findBeatportArtistByName(
  name: string,
  accessToken: string
): Promise<BeatportArtistResult | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const headers = buildHeaders(accessToken);
  const searchUrl = `https://api.beatport.com/v4/catalog/search?type=artist&q=${encodeURIComponent(
    trimmed
  )}`;

  const res = await fetch(searchUrl, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Beatport artist search failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as BeatportSearchResponse;
  const items = data.results?.items ?? [];

  if (!Array.isArray(items) || items.length === 0) return null;

  const lowerName = trimmed.toLowerCase();
  const exact =
    items.find(
      (item) => item.name && item.name.toLowerCase() === lowerName
    ) || null;

  const candidate = exact ?? items[0];
  if (!candidate || candidate.id === undefined) return null;

  const slug =
    candidate.slug ||
    (candidate.name ? candidate.name.toLowerCase().replace(/\s+/g, "-") : "") ||
    `${candidate.id}`;

  const urlCandidate =
    candidate.public_url ||
    candidate.uri ||
    `https://www.beatport.com/artist/${slug}/${candidate.id}`;

  return {
    id: candidate.id,
    name: candidate.name,
    slug,
    url: urlCandidate,
  };
}
