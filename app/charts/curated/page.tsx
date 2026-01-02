import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type PlaylistRow = {
  id: number;
  title: string | null;
  cover_image_url: string | null;
  filters: Record<string, unknown> | string | null;
  order_index: number | null;
  active: boolean | null;
};

type PlaylistFilters = {
  mix_type?: string;
  genre?: string | string[];
  min_score?: number;
  artist_name_contains?: string;
};

type SnapshotRow = {
  track_title: string | null;
  artist_name: string | null;
  score_public: number | null;
  cover_url: string | null;
  mix_type: string | null;
  genre?: string | null;
};

type PlaylistCard = {
  playlist: PlaylistRow;
  results: SnapshotRow[];
};

function parseFilters(filters: PlaylistRow["filters"]): PlaylistFilters {
  if (!filters) return {};
  if (typeof filters === "string") {
    try {
      return JSON.parse(filters) as PlaylistFilters;
    } catch {
      return {};
    }
  }
  if (typeof filters === "object") {
    return filters as PlaylistFilters;
  }
  return {};
}

function normalizeActive(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "t", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "f", "0", "no", "n"].includes(normalized)) return false;
  }
  return null;
}

function matchesFilters(row: SnapshotRow, filters: PlaylistFilters): boolean {
  if (filters.mix_type && row.mix_type !== filters.mix_type) return false;
  if (filters.genre) {
    if (row.genre) {
      const allowed = Array.isArray(filters.genre)
        ? filters.genre
        : [filters.genre];
      if (!allowed.includes(row.genre)) return false;
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

function buildPlaylistCards(
  playlists: PlaylistRow[],
  snapshots: SnapshotRow[]
): PlaylistCard[] {
  return playlists.map((playlist) => {
    const filters = parseFilters(playlist.filters);
    const results = snapshots
      .filter((row) => matchesFilters(row, filters))
      .sort((a, b) => (b.score_public ?? 0) - (a.score_public ?? 0))
      .slice(0, 10);

    return { playlist, results };
  });
}

export default async function ChartsCuratedPageRoute() {
  const supabase = await createClient();

  const [playlistsRes, snapshotsRes] = await Promise.all([
    supabase
      .from("tekkin_charts_curated_playlists")
      .select("*")
      .order("order_index", { ascending: true }),
    supabase
      .from("tekkin_charts_latest_snapshots_v1")
      .select("track_title, artist_name, score_public, cover_url, mix_type"),
  ]);

  if (playlistsRes.error) {
    console.error("[charts] playlists error:", playlistsRes.error);
  }
  if (snapshotsRes.error) {
    console.error("[charts] snapshots error:", snapshotsRes.error);
  }

  const rawPlaylists = (playlistsRes.data ?? []) as Record<string, unknown>[];
  const playlists = rawPlaylists
    .map((row) => {
      const anyRow = row as Record<string, any>;
      const rawActive = anyRow.active ?? anyRow.is_active ?? null;
      const resolvedActive = normalizeActive(rawActive);
      return {
        id: anyRow.id,
        title: anyRow.title ?? null,
        cover_image_url: anyRow.cover_image_url ?? anyRow.cover_url ?? null,
        filters: anyRow.filters ?? null,
        order_index: anyRow.order_index ?? null,
        active: resolvedActive,
      } as PlaylistRow;
    })
    .filter((playlist) => playlist.active !== false);
  const snapshots = (snapshotsRes.data ?? []) as SnapshotRow[];

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
            {cards.map((card, index) => (
              <article
                key={card.playlist.id}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
                style={{
                  animation: "tekkin-fade-in 0.5s ease forwards",
                  animationDelay: `${index * 80}ms`,
                  opacity: 1,
                }}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/5">
                  {card.playlist.cover_image_url ? (
                    <img
                      src={card.playlist.cover_image_url}
                      alt={card.playlist.title ?? "Playlist cover"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.3em] text-white/40">
                      Cover
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">
                      {card.playlist.title ?? "Playlist"}
                    </h2>
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
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
