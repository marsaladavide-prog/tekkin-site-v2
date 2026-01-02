import { createClient } from "@/utils/supabase/server";
import TopArtistsHero from "@/components/charts/TopArtistsHero";
import PlaylistShelf from "@/components/charts/PlaylistShelf";
import ChartsSplitBoard from "@/components/charts/ChartsSplitBoard";
import { mapChartsToUi, RegisteredArtistProfile } from "@/lib/charts/mapChartsToUi";
import { getTrackUrlCached } from "@/lib/storage/getTrackUrlCached";

export const dynamic = "force-dynamic";

type SnapshotRow = {
  profile_key: string;
  project_id: string;
  version_id?: string | null;
  track_title: string | null;
  artist_name: string | null;
  artist_id?: string | null;
  collab_artist_ids?: string[] | null;
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

const formatArtistDisplay = (ownerName: string | null, collaboratorNames: string[]) => {
  const names = [
    ownerName?.trim() ? ownerName.trim() : null,
    ...collaboratorNames,
  ].filter((name): name is string => Boolean(name));

  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} feat. ${names[1]}`;
  return `${names[0]} feat. ${names.slice(1).join(" & ")}`;
};

export default async function ChartsPageRoute() {
  const supabase = await createClient();

  const [periodRes, snapshotsRes] = await Promise.all([
    supabase
      .from("tekkin_charts_latest_period_v1")
      .select("period_start, period_end")
      .maybeSingle<PeriodRow>(),
    supabase
      .from("public_charts_snapshots")
      .select(
        "profile_key, project_id, version_id, track_title, artist_id, cover_url, audio_url, mix_type, rank_position, score_public"
      ),
  ]);

  if (periodRes.error) console.error("[charts] period error:", periodRes.error);
  if (snapshotsRes.error) console.error("[charts] snapshots error:", snapshotsRes.error);

  const period = periodRes.data ?? null;
  const rows = snapshotsRes.data ?? null;

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
    const [likeCountsRes, authRes] = await Promise.all([
      supabase
        .from("track_likes_counts_v1")
        .select("version_id, likes_count")
        .in("version_id", versionIds),
      supabase.auth.getUser(),
    ]);

    likeCountsRes.data?.forEach((r) => {
      likesCountByVersionId.set(r.version_id, r.likes_count ?? 0);
    });

    const user = authRes?.data?.user ?? null;
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
  const artistIdsFromRows = Array.from(
    new Set(
      (rows ?? [])
        .map((row) => row?.artist_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const { data: collabRows, error: collabErr } = await supabase
    .from("project_collaborators")
    .select("project_id, user_id")
    .in("project_id", projectIds);

  if (collabErr) {
    console.error("[charts] project_collaborators error:", collabErr);
  }

  const collabByProjectId = new Map<string, string[]>();
  const collaboratorUserIds = new Set<string>();

  (collabRows ?? []).forEach((row) => {
    if (!row?.project_id || !row?.user_id) return;
    collaboratorUserIds.add(row.user_id);
    const list = collabByProjectId.get(row.project_id) ?? [];
    list.push(row.user_id);
    collabByProjectId.set(row.project_id, list);
  });

  const allArtistUserIds = Array.from(
    new Set([...ownerUserIds, ...artistIdsFromRows, ...Array.from(collaboratorUserIds)])
  );

  // 2) Carichiamo i profili degli artisti registrati (users_profile)
  let registeredArtists: RegisteredArtistProfile[] = [];

  const slugByUserId = new Map<string, string>();
  if (allArtistUserIds.length) {
    const [artistsRes, profileRes] = await Promise.all([
      supabase
        .from("public_artists")
        .select("user_id, artist_name, slug, ig_profile_picture")
        .in("user_id", allArtistUserIds)
        .limit(allArtistUserIds.length),
      supabase
        .from("public_artist_profiles")
        .select("user_id, photo_url, avatar_url")
        .in("user_id", allArtistUserIds)
        .limit(allArtistUserIds.length),
    ]);

    if (artistsRes.error) {
      console.error("[charts] artist profiles error:", artistsRes.error);
    }
    if (profileRes.error) {
      console.error("[charts] artist profile avatars error:", profileRes.error);
    }

    const photoByUserId = new Map<string, { photo_url?: string | null; avatar_url?: string | null }>();
    (profileRes.data ?? []).forEach((row) => {
      if (row?.user_id) {
        photoByUserId.set(row.user_id, {
          photo_url: row.photo_url ?? null,
          avatar_url: row.avatar_url ?? null,
        });
      }
    });

    registeredArtists = (artistsRes.data ?? []).map((row) => {
      const photos = row?.user_id ? photoByUserId.get(row.user_id) : null;
      return {
        ...row,
        photo_url: photos?.photo_url ?? null,
        avatar_url: photos?.avatar_url ?? null,
      };
    });

    (artistsRes.data ?? []).forEach((row) => {
      if (row?.user_id && typeof row.slug === "string" && row.slug.trim()) {
        slugByUserId.set(row.user_id, row.slug.trim());
      }
    });
  }

  // 3) Arricchiamo le righe chart con artist_id/artist_name reali
  const profileByUserId = new Map<string, RegisteredArtistProfile>();
  registeredArtists.forEach((p) => {
    if (p?.user_id) profileByUserId.set(p.user_id, p);
  });

  const enriched = allWithAudio.map((r) => {
    const uid = ownerByProjectId.get(r.project_id) ?? r.artist_id ?? null;
    const prof = uid ? profileByUserId.get(uid) : null;
    const ownerName = prof?.artist_name ?? r.artist_name ?? null;
    const collabIds = collabByProjectId.get(r.project_id) ?? [];
    const collaboratorNames = collabIds
      .map((id) => profileByUserId.get(id)?.artist_name ?? null)
      .filter((name): name is string => Boolean(name));
    const displayName = formatArtistDisplay(ownerName, collaboratorNames) ?? ownerName ?? r.artist_name ?? null;
    const slug = uid ? slugByUserId.get(uid) ?? null : null;
    const collabBadges = [
      ownerName
        ? { label: ownerName, href: slug ? `/@${slug}` : null }
        : null,
      ...collabIds
        .map((id) => {
          const name = profileByUserId.get(id)?.artist_name ?? null;
          const collabSlug = slugByUserId.get(id) ?? null;
          if (!name) return null;
          return { label: name, href: collabSlug ? `/@${collabSlug}` : null };
        })
        .filter((entry): entry is { label: string; href: string | null } => Boolean(entry)),
    ].filter(Boolean);
    return {
      ...r,
      artist_id: uid ?? r.artist_id ?? null,
      artist_name: displayName as string | null,
      artist_slug: slug,
      cover_url: r.cover_url ?? null,
      __artist_avatar_url: (prof?.ig_profile_picture ?? prof?.artist_photo_url ?? null) as string | null,
      collab_artist_ids: collabIds,
      collab_badges: collabBadges.length > 0 ? collabBadges : null,
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
