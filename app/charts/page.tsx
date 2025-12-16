import type { SupabaseClient } from "@supabase/supabase-js";
import ChartsHub from "@/components/charts/ChartsHub";
import { type ChartSnapshotEntry, type TopArtistSummary } from "@/components/charts/types";
import { createClient } from "@/utils/supabase/server";

const SNAPSHOTS_TABLE = "tekkin_charts_snapshots";

async function fetchPeriod(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from(SNAPSHOTS_TABLE)
    .select("period_start, period_end")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[charts] supabase error:", {
      code: (error as any)?.code,
      message: (error as any)?.message,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
    });
    throw error;
  }

  console.log("[charts] rows:", data ? 1 : 0);
  return data ?? null;
}

type SnapshotRow = {
  project_id: string;
  version_id: string;
  track_title: string | null;
  artist_name: string | null;
  artist_id?: string | null;
  cover_url: string | null;
  audio_url: string | null;
  mix_type: string | null;
  rank_position: number;
  score_public: number | null;
};

function normalizeAudioUrl(raw: string | null, supabaseBaseUrl: string | null): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  if (!supabaseBaseUrl) return null;

  // raw può essere:
  // - "<project_id>/<file>.mp3"
  // - "tracks/<project_id>/<file>.mp3"
  const clean = raw.startsWith("tracks/") ? raw.replace(/^tracks\//, "") : raw;
  return `${supabaseBaseUrl}/storage/v1/object/public/tracks/${clean}`;
}

async function fetchSnapshots(
  supabase: SupabaseClient,
  profileKey: string,
  periodStart: string
): Promise<ChartSnapshotEntry[]> {
  const { data, error } = await supabase
    .from(SNAPSHOTS_TABLE)
    .select(
      "project_id, version_id, track_title, artist_name, artist_id, cover_url, audio_url, mix_type, rank_position, score_public"
    )
    .eq("profile_key", profileKey)
    .eq("period_start", periodStart)
    .order("rank_position", { ascending: true })
    .limit(profileKey === "global" ? 100 : 10);

  if (error) {
    console.error("[charts] supabase error:", {
      code: (error as any)?.code,
      message: (error as any)?.message,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
    });
    throw error;
  }

  const rows = (data ?? []) as SnapshotRow[];

  // Se audio_url è già un https assoluto lo usiamo,
  // se invece è un path (tipo projectId/file.mp3) generiamo signed url dal bucket "tracks"
  const signed = await Promise.all(
    rows.map(async (row) => {
      const raw = row.audio_url ?? null;

      let audioUrl: string | null = null;

      if (raw && /^https?:\/\//i.test(raw)) {
        audioUrl = raw;
      } else if (raw) {
        const clean = raw.startsWith("tracks/") ? raw.replace(/^tracks\//, "") : raw;

        const { data: signedData, error: signedErr } = await supabase.storage
          .from("tracks")
          .createSignedUrl(clean, 60 * 60); // 1 ora

        if (signedErr) {
          console.error("[charts] signed url error:", {
            message: (signedErr as any)?.message,
            name: (signedErr as any)?.name,
          });
          audioUrl = null;
        } else {
          audioUrl = signedData?.signedUrl ?? null;
        }
      }

      return {
        project_id: row.project_id,
        version_id: row.version_id,
        track_title: row.track_title,
        artist_name: row.artist_name,
        cover_url: row.cover_url,
        audio_url: audioUrl,
        mix_type: row.mix_type,
        rank_position: row.rank_position,
        score_public: row.score_public ?? null,
      } satisfies ChartSnapshotEntry;
    })
  );

  return signed;
}


function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function loadTopArtistsFromArtistRank(supabase: SupabaseClient): Promise<Array<{ artist_id: string; score: number | null }>> {
  const scoreCandidates = ["tekkin_score", "score_public", "score_0_100"] as const;

  for (const col of scoreCandidates) {
    const res = await supabase
      .from("artist_rank")
      .select(`artist_id, ${col}`)
      .order(col, { ascending: false })
      .limit(20);

    if (!res.error) {
      const rows = (res.data ?? []) as Array<{ artist_id: string | null } & Record<string, unknown>>;
      return rows
        .filter((r) => typeof r.artist_id === "string" && r.artist_id)
        .map((r) => ({
          artist_id: r.artist_id as string,
          score: toFiniteNumber(r[col]),
        }));
    }

    if ((res.error as any)?.code === "42703") continue;

    console.error("[charts][artist_rank] supabase error:", {
      code: (res.error as any)?.code,
      message: (res.error as any)?.message,
      details: (res.error as any)?.details,
      hint: (res.error as any)?.hint,
    });
    throw res.error;
  }

  return [];
}

async function loadTopArtistsFromSnapshots(
  supabase: SupabaseClient,
  periodStart: string
): Promise<Array<{ artist_id: string; score: number | null }>> {
  // Fallback coerente con charts: prendo le righe della settimana e aggrego per artist_id in JS.
  // Se la colonna artist_id non esiste nel DB, qui avrai errore 42703 e te lo loggo.
  const res = await supabase
    .from(SNAPSHOTS_TABLE)
    .select("artist_id, score_public")
    .eq("profile_key", "global")
    .eq("period_start", periodStart)
    .limit(500);

  if (res.error) {
    console.error("[charts][snapshots->artists] supabase error:", {
      code: (res.error as any)?.code,
      message: (res.error as any)?.message,
      details: (res.error as any)?.details,
      hint: (res.error as any)?.hint,
    });
    return [];
  }

  const rows = (res.data ?? []) as Array<{ artist_id: string | null; score_public: number | null }>;

  const map = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    if (!r.artist_id) continue;
    const score = typeof r.score_public === "number" && Number.isFinite(r.score_public) ? r.score_public : 0;
    const cur = map.get(r.artist_id) ?? { sum: 0, count: 0 };
    cur.sum += score;
    cur.count += 1;
    map.set(r.artist_id, cur);
  }

  // rank: somma score_public (o puoi cambiare in media)
  return Array.from(map.entries())
    .map(([artist_id, v]) => ({ artist_id, score: v.sum }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 20);
}
async function fetchArtistsByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Array<{ id: string; artist_name: string | null; ig_profile_picture: string | null; artist_photo_url: string | null }>> {
  const selects = [
    "id, artist_name, artist_photo_url, ig_profile_picture",
    "id, artist_name, artist_photo_url",
    "id, artist_name, ig_profile_picture",
    "id, artist_name",
  ] as const;

  for (const sel of selects) {
    const res = await supabase.from("artists").select(sel).in("id", ids);

    if (!res.error) {
      const rows = (res.data ?? []) as Array<Record<string, unknown>>;
      return rows
        .filter((r) => typeof r.id === "string" && r.id)
        .map((r) => ({
          id: r.id as string,
          artist_name: typeof r.artist_name === "string" ? (r.artist_name as string) : null,
          ig_profile_picture: typeof r.ig_profile_picture === "string" ? (r.ig_profile_picture as string) : null,
          artist_photo_url: typeof r.artist_photo_url === "string" ? (r.artist_photo_url as string) : null,
        }));
    }

    if ((res.error as any)?.code === "42703") continue;

    console.error("[charts][artists] supabase error raw:", res.error);
    console.error("[charts][artists] supabase error fields:", {
      code: (res.error as any)?.code,
      message: (res.error as any)?.message,
      details: (res.error as any)?.details,
      hint: (res.error as any)?.hint,
    });
    throw res.error;
  }

  return [];
}

async function loadTopArtists(
  supabase: SupabaseClient,
  periodStart: string | null
): Promise<TopArtistSummary[]> {
  type ArtistRow = {
    id: string;
    artist_name: string | null;
    ig_profile_picture: string | null;
    artist_photo_url: string | null;
  };

  // 1) Tentativo primario: artist_rank (se esiste e ha dati)
  let rankRows = await loadTopArtistsFromArtistRank(supabase);

  // 2) Fallback: aggregazione da snapshot settimanale (solo se ho un periodo)
  if (rankRows.length === 0 && periodStart) {
    rankRows = await loadTopArtistsFromSnapshots(supabase, periodStart);
  }

  if (rankRows.length === 0) return [];

  const ids = Array.from(new Set(rankRows.map((r) => r.artist_id)));

  const artistsRows = await fetchArtistsByIds(supabase, ids);

  // Merge rank + artist mantenendo l’ordine del rank
  return rankRows
    .map((rankRow) => {
      const artist = artistsRows.find((a) => a.id === rankRow.artist_id);
      if (!artist) return null;

      return {
        id: artist.id,
        artist_name: artist.artist_name ?? null,
        ig_profile_picture: artist.ig_profile_picture ?? null,
        artist_photo_url: artist.artist_photo_url ?? null,
        // Nota: qui stai mettendo score in spotify_followers per compatibilità col type attuale
        spotify_followers: rankRow.score ?? null,
      };
    })
    .filter(Boolean) as TopArtistSummary[];
}

export default async function ChartsPage() {
  const supabase = await createClient();
  const period = await fetchPeriod(supabase);

  let globalSnapshots: ChartSnapshotEntry[] = [];
  let qualitySnapshots: ChartSnapshotEntry[] = [];

  if (period?.period_start) {
    [globalSnapshots, qualitySnapshots] = await Promise.all([
      fetchSnapshots(supabase, "global", period.period_start),
      fetchSnapshots(supabase, "quality", period.period_start),
    ]);
  }

  const topArtists = await loadTopArtists(supabase, period?.period_start ?? null);

  return (
    <ChartsHub
      periodStart={period?.period_start ?? null}
      periodEnd={period?.period_end ?? null}
      globalSnapshots={globalSnapshots}
      qualitySnapshots={qualitySnapshots}
      topArtists={topArtists}
    />
  );
}
