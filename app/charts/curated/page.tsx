import { createAdminClient } from "@/utils/supabase/admin";
import type { ChartSnapshotEntry } from "@/components/charts/types";

export const dynamic = "force-dynamic";

type CircuitPlaylist = {
  id: string;
  title: string | null;
  slug: string | null;
  description: string | null;
  cover_url: string | null;
  filters: Record<string, unknown> | null;
};

type PlaylistCard = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  filters: PlaylistFilters;
  results: ChartSnapshotEntry[];
};

type PlaylistFilters = {
  mix_type?: string;
  genre?: string | string[];
  min_score?: number;
  artist_name_contains?: string;
};

function safeParseFilters(value: Record<string, unknown> | null): PlaylistFilters {
  if (!value) return {};
  const filters: PlaylistFilters = {};
  if (typeof value.mix_type === "string") filters.mix_type = value.mix_type;
  if (typeof value.genre === "string") filters.genre = value.genre;
  if (Array.isArray(value.genre)) {
    filters.genre = value.genre.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value.min_score === "number") filters.min_score = value.min_score;
  if (typeof value.artist_name_contains === "string" && value.artist_name_contains.trim()) {
    filters.artist_name_contains = value.artist_name_contains.trim();
  }
  return filters;
}

function matchesFilters(row: ChartSnapshotEntry, filters: PlaylistFilters): boolean {
  if (filters.mix_type && row.mix_type !== filters.mix_type) return false;
  if (filters.genre) {
    const rowGenre = (row as Record<string, unknown>).genre;
    if (typeof rowGenre === "string") {
      const allowed = Array.isArray(filters.genre) ? filters.genre : [filters.genre];
      if (!allowed.includes(rowGenre)) return false;
    }
  }
  if (typeof filters.min_score === "number") {
    const score = typeof row.score_public === "number" ? row.score_public : 0;
    if (score < filters.min_score) return false;
  }
  if (filters.artist_name_contains) {
    const target = row.artist_name?.toLowerCase() ?? "";
    if (!target.includes(filters.artist_name_contains.toLowerCase())) return false;
  }
  return true;
}

function buildFilterSummary(filters: PlaylistFilters): string {
  const parts: string[] = [];
  if (filters.mix_type) parts.push(`mix_type: ${filters.mix_type}`);
  if (filters.genre) {
    const genreValue = Array.isArray(filters.genre) ? filters.genre.join(", ") : filters.genre;
    parts.push(`genre: ${genreValue}`);
  }
  if (typeof filters.min_score === "number") parts.push(`min_score: ${filters.min_score}`);
  if (filters.artist_name_contains) {
    parts.push(`artist_name_contains: ${filters.artist_name_contains}`);
  }
  return parts.join(" | ");
}

function buildPlaylistCards(playlists: CircuitPlaylist[], snapshots: ChartSnapshotEntry[]): PlaylistCard[] {
  return playlists.map((playlist) => {
    const filters = safeParseFilters(playlist.filters);
    const results = snapshots
      .filter((row) => matchesFilters(row, filters))
      .sort((a, b) => (b.score_public ?? 0) - (a.score_public ?? 0))
      .slice(0, 10);
    const title =
      playlist.title?.trim() ||
      playlist.slug?.trim() ||
      "Playlist Tekkin";
    const description = playlist.description?.trim() || null;
    return {
      id: playlist.id,
      title,
      description,
      coverUrl: playlist.cover_url,
      filters,
      results,
    };
  });
}

async function fetchCircuitPlaylistsAndSnapshots() {
  const supabase = createAdminClient();
  const [playlistsRes, snapshotsRes] = await Promise.all([
    supabase
      .from("tekkin_charts_curated_playlists")
      .select("id, title, slug, description, cover_url, filters, is_active")
      .eq("is_active", true)
      .order("order_index", { ascending: true }),
    supabase
      .from("tekkin_charts_latest_snapshots_v1")
      .select(
        "track_title, artist_name, score_public, collab_artist_ids, mix_type, cover_url, profile_key"
      ),
  ]);
  if (playlistsRes.error) {
    console.error("[charts] playlists error:", playlistsRes.error);
    return { playlists: [], snapshots: [] };
  }
  if (snapshotsRes.error) {
    console.error("[charts] snapshots error:", snapshotsRes.error);
  }
  return {
    playlists: (playlistsRes.data ?? []) as CircuitPlaylist[],
    snapshots: (snapshotsRes.data ?? []) as ChartSnapshotEntry[],
  };
}

export default async function ChartsCuratedPageRoute() {
  const { playlists, snapshots } = await fetchCircuitPlaylistsAndSnapshots();
  const cards = buildPlaylistCards(playlists, snapshots);

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Charts</h1>
          <p className="text-sm text-white/70">
            Playlist curate dalla community Tekkin, aggiornate ogni settimana.
          </p>
        </header>

        {cards.length === 0 ? (
          <p className="text-sm text-white/60">Nessuna playlist disponibile.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, index) => {
              const filterSummary = buildFilterSummary(card.filters);
              return (
                <article
                  key={card.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
                  style={{
                    animation: "tekkin-fade-in 0.5s ease forwards",
                    animationDelay: `${index * 80}ms`,
                    opacity: 1,
                  }}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-white/5 via-white/10 to-black">
                    {card.coverUrl ? (
                      <img
                        src={card.coverUrl}
                        alt={card.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.3em] text-white/40">
                        <span
                          className="tekkin-glitch text-[12px] font-semibold tracking-[0.5em]"
                          data-text="GLITCH"
                        >
                          GLITCH
                        </span>
                        Cover
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70" />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold">{card.title}</h2>
                      <p className="text-sm text-white/60">
                        {card.description ?? "Nessuna descrizione"}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                        {filterSummary || "Filtri: nessuno"}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {card.results.length === 0 ? (
                        <p className="text-sm text-white/60">
                          Nessun risultato disponibile
                        </p>
                      ) : (
                        card.results.map((row, idx) => (
                          <div
                            key={`${row.track_title ?? "track"}-${idx}`}
                            className="flex items-center gap-3"
                          >
                            <div className="h-10 w-10 overflow-hidden rounded-md bg-white/10">
                              {row.cover_url ? (
                                <img
                                  src={row.cover_url}
                                  alt={row.track_title ?? "Track cover"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.3em] text-white/30">
                                  Art
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-white">
                                {row.track_title ?? "Senza titolo"}
                              </p>
                              <p className="truncate text-xs text-white/60">
                                {row.artist_name ?? "Artista sconosciuto"}
                              </p>
                            </div>
                            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/70">
                              {typeof row.score_public === "number"
                                ? row.score_public
                                : "-"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
