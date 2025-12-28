const SPOTIFY_TYPES = new Set([
  "track",
  "album",
  "playlist",
  "artist",
  "episode",
  "show",
]);

export function toSpotifyEmbedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // spotify:track:ID
  if (raw.startsWith("spotify:")) {
    const parts = raw.split(":").filter(Boolean);
    // ["spotify", "track", "ID"]
    if (parts.length >= 3) {
      const type = parts[1];
      const id = parts[2];
      if (SPOTIFY_TYPES.has(type) && id) {
        return `https://open.spotify.com/embed/${type}/${id}`;
      }
    }
    return null;
  }

  // http(s) urls
  try {
    const u = new URL(raw);

    // già embed
    if (u.hostname.endsWith("open.spotify.com") && u.pathname.startsWith("/embed/")) {
      return `https://open.spotify.com${u.pathname}${u.search}`;
    }

    // link normali: /track/{id} ecc
    if (u.hostname.endsWith("open.spotify.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const type = parts[0];
        const id = parts[1];
        if (SPOTIFY_TYPES.has(type) && id) {
          return `https://open.spotify.com/embed/${type}/${id}`;
        }
      }
    }

    // shortlinks tipo spotify.link non li possiamo convertire senza chiamare rete
    return null;
  } catch {
    return null;
  }
}
