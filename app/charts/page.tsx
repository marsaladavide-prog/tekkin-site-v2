import { createClient } from "@/utils/supabase/server";
import TopArtistsHero from "@/components/charts/TopArtistsHero";
import PlaylistShelf from "@/components/charts/PlaylistShelf";
import ChartsSplitBoard from "@/components/charts/ChartsSplitBoard";
import {
  mapChartsToUi,
  RegisteredArtistProfile,
} from "@/lib/charts/mapChartsToUi";

export const dynamic = "force-dynamic";

type SnapshotRow = {
  profile_key: string;
  project_id: string;
  version_id?: string | null;
  track_title: string | null;
  artist_name: string | null;
  artist_id?: string | null;
  cover_url: string | null;
  audio_url: string | null;
  mix_type: string | null;
  rank_position: number;
  score_public: number | null;
};

type PeriodRow = {
  period_start: string | null;
  period_end: string | null;
};

const PROFILE_COLUMNS = `
  user_id,
  artist_name,
  avatar_url,
  photo_url,
  spotify_url
`;

export default async function ChartsPageRoute() {
  const supabase = await createClient();

  const { data: period, error: periodErr } = await supabase
    .from("tekkin_charts_latest_period_v1")
    .select("period_start, period_end")
    .maybeSingle<PeriodRow>();

  if (periodErr) console.error("[charts] period error:", periodErr);

  const { data: rows, error: snapshotsErr } = await supabase
    .from("tekkin_charts_latest_snapshots_v1")
    .select(
      "profile_key, project_id, version_id, track_title, artist_name, artist_id, cover_url, audio_url, mix_type, rank_position, score_public"
    );

  if (snapshotsErr) console.error("[charts] snapshots error:", snapshotsErr);

  const all = (rows ?? []) as SnapshotRow[];

  // 1) Risaliamo ai proprietari dei project usando project_id -> projects.user_id
  const projectIds = Array.from(
    new Set(
      all
        .map((r) => r.project_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    )
  );

  const { data: projectOwners, error: projectOwnersErr } = await supabase
    .from("projects")
    .select("id, user_id")
    .in("id", projectIds);

  if (projectOwnersErr) {
    console.error("[charts] projects owner error:", projectOwnersErr);
  }

  const ownerByProjectId = new Map<string, string>();
  (projectOwners ?? []).forEach((p) => {
    if (p?.id && p?.user_id) ownerByProjectId.set(p.id, p.user_id);
  });

  const ownerUserIds = Array.from(
    new Set(Array.from(ownerByProjectId.values()).filter(Boolean))
  );

  // 2) Carichiamo i profili degli artisti registrati (users_profile)
  let registeredArtists: RegisteredArtistProfile[] = [];

  if (ownerUserIds.length) {
    const { data: artistProfiles, error: artistProfilesErr } = await supabase
      .from("users_profile")
      .select("user_id, artist_name, photo_url, avatar_url, role")
      .in("user_id", ownerUserIds)
      .eq("role", "artist");

    if (artistProfilesErr) {
      console.error("[charts] artist profiles error:", artistProfilesErr);
    }

    registeredArtists = artistProfiles ?? [];
  }

  // 3) Arricchiamo le righe chart con artist_id/artist_name reali
  const profileByUserId = new Map<string, RegisteredArtistProfile>();
  registeredArtists.forEach((p) => {
    if (p?.user_id) profileByUserId.set(p.user_id, p);
  });

  const enriched = all.map((r) => {
    const uid = ownerByProjectId.get(r.project_id) ?? null;
    const prof = uid ? profileByUserId.get(uid) : null;

    return {
      ...r,
      artist_id: uid ?? r.artist_id ?? null,
      artist_name: (prof?.artist_name ?? r.artist_name ?? null) as string | null,
      cover_url: r.cover_url ?? null,
      __artist_avatar_url: (prof?.avatar_url ?? prof?.photo_url ?? null) as string | null,
    };
  });

  const uiState = mapChartsToUi(enriched as any, registeredArtists, period ?? null);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-2 sm:px-6">
        <TopArtistsHero
          artists={uiState.topArtists}
          periodStart={uiState.periodStart}
          periodEnd={uiState.periodEnd}
        />
        <PlaylistShelf playlists={uiState.playlists} />
        <ChartsSplitBoard
          globalItems={uiState.globalTop100}
          qualityItems={uiState.qualityTop10}
        />
      </div>
    </main>
  );
}
