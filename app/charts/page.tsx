import { createClient } from "@/utils/supabase/server";
import TopArtistsHero from "@/components/charts/TopArtistsHero";
import PlaylistShelf from "@/components/charts/PlaylistShelf";
import ChartsSplitBoard from "@/components/charts/ChartsSplitBoard";
import {
  mapChartsToUi,
  RegisteredArtistProfile,
} from "@/lib/charts/mapChartsToUi";
import { getTrackUrlCached } from "@/lib/storage/getTrackUrlCached";

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
  plays?: number;
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

  const versionIds =
    rows
      ?.map((r) => r.version_id)
      .filter((v): v is string => Boolean(v)) ?? [];

  const playsByVersionId = new Map<string, number>();

  if (versionIds.length > 0) {
    const { data: counters } = await supabase
      .from("tekkin_track_counters")
      .select("version_id, plays")
      .in("version_id", versionIds);

    counters?.forEach((c) => {
      playsByVersionId.set(c.version_id, c.plays ?? 0);
    });
  }

  // Likes (counts + liked by current user)
  const likesCountByVersionId = new Map<string, number>();
  const likedSet = new Set<string>();

  if (versionIds.length > 0) {
    const { data: likeCounts } = await supabase
      .from("track_likes_counts_v1")
      .select("version_id, likes_count")
      .in("version_id", versionIds);

    likeCounts?.forEach((r) => {
      likesCountByVersionId.set(r.version_id, r.likes_count ?? 0);
    });

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (user) {
      const { data: myLikes } = await supabase
        .from("track_likes")
        .select("version_id")
        .in("version_id", versionIds)
        .eq("user_id", user.id);

      myLikes?.forEach((r) => likedSet.add(r.version_id));
    }
  }

  const all = (rows ?? []) as SnapshotRow[];

  const AUDIO_BUCKET = "tracks"; // <-- METTI IL NOME GIUSTO

  // Se il bucket "tracks" e' PUBLIC puoi usare mode:"public" e finisce la storia.
  // Se NON e' public, resta signed ma almeno con cache (molto meno spreco).
  const CHARTS_URL_MODE: "public" | "signed" = "signed";

  const allWithAudio = await Promise.all(
    all.map(async (r) => {
      let raw = r.audio_url?.trim();
      if (!raw) return r;
      if (raw.startsWith("http")) return r;
      if (raw.startsWith("tracks/")) raw = raw.slice("tracks/".length);

      const url = await getTrackUrlCached(supabase, AUDIO_BUCKET, raw, {
        mode: CHARTS_URL_MODE,
        expiresInSeconds: 60 * 60,
        revalidateSeconds: 60 * 20,
      });

      return { ...r, audio_url: url ?? r.audio_url };
    })
  );

  // 1) Risaliamo ai proprietari dei project usando project_id -> projects.user_id
  const projectIds = Array.from(
    new Set(
      allWithAudio
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

  const slugByUserId = new Map<string, string>();
  if (ownerUserIds.length > 0) {
    const { data: slugRows, error: slugRowsErr } = await supabase
      .from("artists")
      .select("user_id, slug")
      .in("user_id", ownerUserIds);

    if (slugRowsErr) {
      console.error("[charts] artist slugs error:", slugRowsErr);
    } else {
      slugRows?.forEach((row) => {
        if (row?.user_id && typeof row.slug === "string" && row.slug.trim()) {
          slugByUserId.set(row.user_id, row.slug.trim());
        }
      });
    }
  }

  // 3) Arricchiamo le righe chart con artist_id/artist_name reali
  const profileByUserId = new Map<string, RegisteredArtistProfile>();
  registeredArtists.forEach((p) => {
    if (p?.user_id) profileByUserId.set(p.user_id, p);
  });

  const enriched = allWithAudio.map((r) => {
    const uid = ownerByProjectId.get(r.project_id) ?? null;
    const prof = uid ? profileByUserId.get(uid) : null;

    const slug = uid ? slugByUserId.get(uid) ?? null : null;
    return {
      ...r,
      artist_id: uid ?? r.artist_id ?? null,
      artist_name: (prof?.artist_name ?? r.artist_name ?? null) as string | null,
      artist_slug: slug,
      cover_url: r.cover_url ?? null,
      __artist_avatar_url: (prof?.avatar_url ?? prof?.photo_url ?? null) as string | null,
      plays: playsByVersionId.get(r.version_id ?? "") ?? 0,
      likes: likesCountByVersionId.get(r.version_id ?? "") ?? 0,
      liked: likedSet.has(r.version_id ?? ""),
    };
  });

  console.log("[charts] enriched audio_url sample:", enriched?.[0]?.audio_url);

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
