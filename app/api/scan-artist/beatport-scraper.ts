// NOTA: attualmente non usato da /api/scan-artist. La pagina Beatport search è una SPA
// e con una semplice fetch lato server non riusciamo a leggere i risultati.
// Da riattivare solo se in futuro usiamo API ufficiali o un browser headless.
export async function findBeatportArtistUrl(
  name: string
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const query = encodeURIComponent(trimmed);
  const searchUrl = `https://www.beatport.com/search?q=${query}`;

  const res = await fetch(searchUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Tekkin Identity Sync)",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    console.error("[BeatportScraper] search failed", res.status);
    return null;
  }

  const html = await res.text();
  console.log("[BeatportScraper] html length:", html.length);

  if (!html.includes("/artist/")) {
    console.log("[BeatportScraper] nessuna occorrenza di '/artist/' nell'HTML.");
    return null;
  }

  const firstIdx = html.indexOf("/artist/");
  const debugSnippet = html.slice(Math.max(0, firstIdx - 80), firstIdx + 200);
  console.log("[BeatportScraper] snippet artista:", debugSnippet);

  const patterns: RegExp[] = [
    /\/artist\/([^\/"']+)\/(\d+)/i,
    /\/artist\/([^\/"']+)/i,
    /href=["']\/artist\/([^"']+)["']/i,
  ];

  for (const regex of patterns) {
    const m = html.match(regex);
    if (!m) continue;

    if (m.length >= 3 && /\d+/.test(m[2])) {
      const slug = m[1];
      const id = m[2];
      const url = `https://www.beatport.com/artist/${slug}/${id}`;
      console.log("[BeatportScraper] match (slug+id):", url);
      return url;
    }

    const path = m[1];
    const url = `https://www.beatport.com/artist/${path}`;
    console.log("[BeatportScraper] match (generic path):", url);
    return url;
  }

  console.log("[BeatportScraper] nessun match valido per artista.");
  return null;
}
