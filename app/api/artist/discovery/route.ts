import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type { ArtistMetrics } from "@/types/tekkinRank";
import { computeArtistRank } from "@/lib/tekkin/computeArtistRank";

function clampScoreValue(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function parseOverallScore(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampScoreValue(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return clampScoreValue(parsed);
    }
  }
  return null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const includePrivate = Boolean(user);

    const { data, error } = await admin
      .from("users_profile")
      .select(
        `
        id,
        user_id,
        artist_name,
        avatar_url,
        photo_url,
        main_genres,
        bio_short,
        city,
        country,
        open_to_collab,
        open_to_promo,
        spotify_url,
        instagram_username,
        beatport_url,
        role,
        created_at
      `
      )
      .eq("role", "artist")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/artist/discovery] supabase error:", error);
      return NextResponse.json(
        { error: "Errore caricando la lista artisti" },
        { status: 500 }
      );
    }

    const rows = data ?? [];

    const userIds = Array.from(
      new Set(
        rows
          .map((row) => row?.user_id ?? row?.id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const profileIds = Array.from(
      new Set(
        rows
          .map((row) => row?.id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const slugByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: slugRows, error: slugError } = await admin
        .from("artists")
        .select("user_id, slug")
        .in("user_id", userIds);

      if (slugError) {
        console.error("[GET /api/artist/discovery] slug lookup error:", slugError);
      } else {
        slugRows?.forEach((row) => {
          if (row?.user_id && typeof row.slug === "string" && row.slug.trim()) {
            slugByUserId.set(row.user_id, row.slug.trim());
          }
        });
      }
    }

    const accessByUserId = new Map<string, { access_status?: string | null; plan?: string | null }>();
    if (userIds.length > 0) {
      const { data: accessRows, error: accessError } = await admin
        .from("artist_access")
        .select("user_id, access_status, plan")
        .in("user_id", userIds);

      if (accessError) {
        console.error("[GET /api/artist/discovery] access lookup error:", accessError);
      } else {
        accessRows?.forEach((row) => {
          if (row?.user_id) {
            accessByUserId.set(row.user_id, {
              access_status: row.access_status ?? null,
              plan: row.plan ?? null,
            });
          }
        });
      }
    }

    const metricsByArtistId = new Map<string, ArtistMetrics>();
    if (profileIds.length > 0) {
      const cutoff30d = new Date();
      cutoff30d.setDate(cutoff30d.getDate() - 30);
      const cutoff12m = new Date();
      cutoff12m.setFullYear(cutoff12m.getFullYear() - 1);

      const { data: metricsRows, error: metricsErr } = await admin
        .from("artist_metrics_daily")
        .select("artist_id, spotify_followers, spotify_popularity, collected_at")
        .in("artist_id", profileIds)
        .gte("collected_at", cutoff30d.toISOString())
        .order("collected_at", { ascending: false });

      if (metricsErr) {
        console.error("[GET /api/artist/discovery] metrics lookup error:", metricsErr);
      }

      const metricsRowsByArtist = new Map<string, any[]>();
      (metricsRows ?? []).forEach((row: any) => {
        if (!row?.artist_id) return;
        const list = metricsRowsByArtist.get(row.artist_id) ?? [];
        list.push(row);
        metricsRowsByArtist.set(row.artist_id, list);
      });

      const { data: releasesRows, error: releasesErr } = await admin
        .from("artist_spotify_releases")
        .select("artist_id, release_date")
        .in("artist_id", profileIds);

      if (releasesErr) {
        console.error("[GET /api/artist/discovery] releases lookup error:", releasesErr);
      }

      const releasesByArtist = new Map<string, { total: number; last12m: number }>();
      (releasesRows ?? []).forEach((row: any) => {
        if (!row?.artist_id) return;
        const prev = releasesByArtist.get(row.artist_id) ?? { total: 0, last12m: 0 };
        const next = { ...prev };
        next.total += 1;
        if (row.release_date) {
          const releaseDate = new Date(row.release_date as string);
          if (!Number.isNaN(releaseDate.getTime()) && releaseDate >= cutoff12m) {
            next.last12m += 1;
          }
        }
        releasesByArtist.set(row.artist_id, next);
      });

      const { data: projectsRows, error: projectsErr } = await admin
        .from("projects")
        .select("id, user_id")
        .in("user_id", userIds);

      if (projectsErr) {
        console.error("[GET /api/artist/discovery] projects lookup error:", projectsErr);
      }

      const projectIds = (projectsRows ?? [])
        .map((row: any) => row?.id)
        .filter((value: any) => typeof value === "string" && value.length > 0);
      const projectIdsByUser = new Map<string, string[]>();
      (projectsRows ?? []).forEach((row: any) => {
        if (!row?.user_id || !row?.id) return;
        const list = projectIdsByUser.get(row.user_id) ?? [];
        list.push(row.id);
        projectIdsByUser.set(row.user_id, list);
      });

      const versionsByProject = new Map<string, any[]>();
      if (projectIds.length > 0) {
        const { data: versionRows, error: versionErr } = await admin
          .from("project_versions")
          .select("project_id, overall_score, created_at, analyzer_json")
          .in("project_id", projectIds);

        if (versionErr) {
          console.error("[GET /api/artist/discovery] versions lookup error:", versionErr);
        }

        (versionRows ?? []).forEach((row: any) => {
          if (!row?.project_id) return;
          const list = versionsByProject.get(row.project_id) ?? [];
          list.push(row);
          versionsByProject.set(row.project_id, list);
        });
      }

      rows.forEach((row: any) => {
        const profileId = row?.id ?? null;
        const ownerId = row?.user_id ?? row?.id ?? null;
        if (!profileId || !ownerId) return;

        const metricsList = metricsRowsByArtist.get(profileId) ?? [];
        const latestMetrics = metricsList[0] ?? null;
        const oldestMetrics = metricsList[metricsList.length - 1] ?? null;

        const spotify_followers = latestMetrics?.spotify_followers ?? null;
        const spotify_followers_30d_ago =
          oldestMetrics?.spotify_followers ?? spotify_followers ?? null;

        const spotify_followers_diff_30d =
          spotify_followers !== null && spotify_followers_30d_ago !== null
            ? Math.max(spotify_followers - spotify_followers_30d_ago, 0)
            : null;

        const spotify_popularity = latestMetrics?.spotify_popularity ?? null;
        const collected_at = latestMetrics?.collected_at ?? null;

        const releasesInfo = releasesByArtist.get(profileId) ?? {
          total: 0,
          last12m: 0,
        };

        const projectIdsForUser = projectIdsByUser.get(ownerId) ?? [];
        let analyzed_versions = 0;
        let analysis_score_average: number | null = null;
        let analysis_score_best: number | null = null;
        let analysis_score_latest: number | null = null;
        let analysis_score_count = 0;

        if (projectIdsForUser.length > 0) {
          const scores: { score: number; createdAt: number }[] = [];

          projectIdsForUser.forEach((projectId) => {
            const versions = versionsByProject.get(projectId) ?? [];
            versions.forEach((version) => {
              if (version?.analyzer_json) analyzed_versions += 1;
              const parsed = parseOverallScore(version?.overall_score);
              if (parsed != null) {
                const createdAt = version?.created_at
                  ? Date.parse(version.created_at as string)
                  : 0;
                scores.push({ score: parsed, createdAt });
              }
            });
          });

          if (scores.length > 0) {
            analysis_score_count = scores.length;
            analysis_score_best = Math.max(...scores.map((s) => s.score));
            scores.sort((a, b) => b.createdAt - a.createdAt);
            analysis_score_latest = scores[0]?.score ?? null;
            const sum = scores.reduce((acc, entry) => acc + entry.score, 0);
            analysis_score_average = Math.round(sum / scores.length);
          }
        }

        const hasAnyMetrics =
          spotify_followers !== null ||
          spotify_popularity !== null ||
          releasesInfo.total > 0 ||
          analyzed_versions > 0 ||
          analysis_score_count > 0;

        if (!hasAnyMetrics) return;

        metricsByArtistId.set(profileId, {
          spotify_followers,
          spotify_followers_30d_ago,
          spotify_followers_diff_30d,
          spotify_popularity,
          total_releases: releasesInfo.total,
          releases_last_12m: releasesInfo.last12m,
          analyzed_versions,
          analysis_score_average,
          analysis_score_best,
          analysis_score_latest,
          analysis_score_count,
          collected_at,
        });
      });
    }

    const artists =
      rows.map((row) => {
        const ownerId = row?.user_id ?? row?.id ?? null;
        const slug = ownerId ? slugByUserId.get(ownerId) ?? null : null;
        const access = ownerId ? accessByUserId.get(ownerId) ?? null : null;
        const accessStatus = access?.access_status ?? "inactive";
        const metrics = row?.id ? metricsByArtistId.get(row.id) ?? null : null;
        const rank = computeArtistRank(metrics);
        return {
          id: row.id,
          artist_name: row.artist_name ?? "Tekkin Artist",
          artist_photo_url: row.avatar_url ?? row.photo_url ?? null,
          main_genres: Array.isArray(row.main_genres)
            ? row.main_genres.filter(Boolean)
            : row.main_genres
            ? [row.main_genres]
            : [],
          bio_short: row.bio_short ?? null,
          city: row.city ?? null,
          country: row.country ?? null,
          open_to_collab: Boolean(row.open_to_collab),
          open_to_promo: Boolean(row.open_to_promo),
          spotify_url: row.spotify_url ?? null,
          instagram_username: row.instagram_username ?? null,
          beatport_url: row.beatport_url ?? null,
          artist_slug: slug,
          access_status: accessStatus,
          access_plan: access?.plan ?? "free",
          is_subscribed: accessStatus === "active",
          tekkin_score: rank.tekkin_score,
          tekkin_phase: rank.phase,
          created_at: row.created_at ?? null,
        };
      }) ?? [];

    const visibleArtists = includePrivate
      ? artists
      : artists.filter((artist) => artist.is_subscribed);

    return NextResponse.json({ artists: visibleArtists });
  } catch (err) {
    console.error("[GET /api/artist/discovery] unexpected error:", err);
    return NextResponse.json(
      { error: "Errore caricando la lista artisti" },
      { status: 500 }
    );
  }
}
