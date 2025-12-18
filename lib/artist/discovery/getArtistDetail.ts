import "server-only";

import { getSupabaseAdmin } from "@/app/api/artist/profile";
import type { ArtistMetrics, ArtistRank } from "@/types/tekkinRank";
import { computeArtistRank } from "@/lib/tekkin/computeArtistRank";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ArtistDetailResponse = {
  artist: {
    id: string;
    artist_name: string | null;
    artist_photo_url: string | null;
    main_genres: string[];
    bio_short: string | null;
    city: string | null;
    country: string | null;
    open_to_collab: boolean;
    spotify_url: string | null;
    instagram_username: string | null;
    beatport_url: string | null;
    presskit_link: string | null;
  } | null;
  metrics: ArtistMetrics | null;
  rank: ArtistRank | null;
  releases: {
    id: string;
    title: string;
    release_date: string | null;
    cover_url: string | null;
    spotify_url: string | null;
    album_type: string | null;
  }[];
  error: string | null;
  artist_slug: string | null;
};

export async function getArtistDetail(artistId: string): Promise<ArtistDetailResponse> {
  if (!artistId || !uuidRegex.test(artistId)) {
    return {
      artist: null,
      metrics: null,
      rank: null,
      releases: [],
      error: "ID artista non valido",
      artist_slug: null,
    };
  }

  try {
    const supabase = getSupabaseAdmin();

    const userColumns = `
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
      spotify_url,
      instagram_username,
      beatport_url,
      presskit_link
    `;

    const { data, error } = await supabase
      .from("users_profile")
      .select(userColumns)
      .or(`id.eq.${artistId},user_id.eq.${artistId}`)
      .maybeSingle();

    if (error) {
      console.error("[getArtistDetail] users_profile error:", error);
      return {
        artist: null,
        metrics: null,
        rank: null,
        releases: [],
        error: "Errore caricando l'artista",
        artist_slug: null,
      };
    }

    let profileData: any = data;

    if (!profileData) {
      const { data: artistRow, error: artistErr } = await supabase
        .from("artists")
        .select(
          `
          id,
          user_id,
          artist_name,
          artist_photo_url,
          artist_genre,
          spotify_url,
          instagram_url,
          beatport_url,
          presskit_link
        `
        )
        .eq("id", artistId)
        .maybeSingle();

      if (artistErr) {
        console.error("[getArtistDetail] artists lookup error:", artistErr);
      }

      if (artistRow) {
        profileData = {
          id: artistRow.id,
          user_id: artistRow.user_id ?? artistRow.id,
          artist_name: artistRow.artist_name,
          avatar_url: artistRow.artist_photo_url,
          photo_url: artistRow.artist_photo_url,
          main_genres: artistRow.artist_genre ? [artistRow.artist_genre] : [],
          bio_short: null,
          city: null,
          country: null,
          open_to_collab: false,
          spotify_url: artistRow.spotify_url ?? null,
          instagram_username: artistRow.instagram_url ?? null,
          beatport_url: artistRow.beatport_url ?? null,
          presskit_link: artistRow.presskit_link ?? null,
        };
      }
    }

    if (!profileData) {
      return {
        artist: null,
        metrics: null,
        rank: null,
        releases: [],
        error: "Artista non trovato",
        artist_slug: null,
      };
    }

    const profileId = profileData.id;
    const profileUserId = profileData.user_id ?? profileId;

    let artistSlug: string | null = null;
    const { data: slugRow, error: slugError } = await supabase
      .from("artists")
      .select("slug")
      .or(`id.eq.${profileId},user_id.eq.${profileUserId}`)
      .maybeSingle();

    if (slugError) {
      console.error("[getArtistDetail] artist slug error:", slugError);
    } else if (slugRow?.slug) {
      artistSlug = slugRow.slug;
    }

    const artist = {
      id: profileData.id,
      artist_name: profileData.artist_name,
      artist_photo_url: profileData.avatar_url ?? profileData.photo_url ?? null,
      main_genres: Array.isArray(profileData.main_genres)
        ? profileData.main_genres
        : profileData.main_genres
        ? [profileData.main_genres]
        : [],
      bio_short: profileData.bio_short,
      city: profileData.city,
      country: profileData.country,
      open_to_collab: profileData.open_to_collab ?? false,
      spotify_url: profileData.spotify_url ?? null,
      instagram_username: profileData.instagram_username ?? null,
      beatport_url: profileData.beatport_url ?? null,
      presskit_link: profileData.presskit_link ?? null,
    };

    // 2) metrics daily
    const { data: metricsRows, error: metricsErr } = await supabase
      .from("artist_metrics_daily")
      .select(`spotify_followers, spotify_popularity, collected_at`)
      .eq("artist_id", profileId)
      .order("collected_at", { ascending: false })
      .limit(30);

    if (metricsErr) {
      console.error("[getArtistDetail] metrics error:", metricsErr);
    }

    let spotify_followers: number | null = null;
    let spotify_followers_30d_ago: number | null = null;
    let spotify_followers_diff_30d: number | null = null;
    let spotify_popularity: number | null = null;
    let collected_at: string | null = null;

    if (metricsRows && metricsRows.length > 0) {
      const latest = metricsRows[0];
      const oldest = metricsRows[metricsRows.length - 1];

      spotify_followers = latest.spotify_followers ?? null;
      spotify_followers_30d_ago = oldest.spotify_followers ?? spotify_followers;

      if (spotify_followers !== null && spotify_followers_30d_ago !== null) {
        spotify_followers_diff_30d = Math.max(
          spotify_followers - spotify_followers_30d_ago,
          0
        );
      }

      spotify_popularity = latest.spotify_popularity ?? null;
      collected_at = latest.collected_at ?? null;
    }

    // 3) releases
    const { data: releasesRows, error: releasesErr } = await supabase
      .from("artist_spotify_releases")
      .select(`id, title, release_date, cover_url, spotify_url, album_type, position`)
      .eq("artist_id", profileId)
      .order("position", { ascending: true });

    if (releasesErr) {
      console.error("[getArtistDetail] releases error:", releasesErr);
    }

    const releases =
      releasesRows?.map((r: any) => ({
        id: r.id,
        title: r.title,
        release_date: r.release_date,
        cover_url: r.cover_url,
        spotify_url: r.spotify_url,
        album_type: r.album_type,
      })) ?? [];

    const total_releases = releasesRows?.length ?? 0;

    const now = new Date();
    const cutoff = new Date();
    cutoff.setFullYear(now.getFullYear() - 1);

    const releases_last_12m =
      releasesRows?.filter((r: any) => {
        if (!r.release_date) return false;
        const d = new Date(r.release_date as string);
        return d >= cutoff;
      }).length ?? 0;

    // 4) analyzed versions
    let analyzed_versions = 0;

    const { data: projectIdRows, error: projectIdErr } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", profileUserId);

    if (projectIdErr) {
      console.error("[getArtistDetail] project ids error:", projectIdErr);
    } else {
      const projectIds = projectIdRows?.map((row: any) => row.id) ?? [];

      if (projectIds.length > 0) {
        const { data: versionsRows, error: versionsErr } = await supabase
          .from("project_versions")
          .select("id")
          .in("project_id", projectIds)
          .not("analyzer_json", "is", null);

        if (versionsErr) {
          console.error("[getArtistDetail] versions error:", versionsErr);
        } else {
          analyzed_versions = versionsRows?.length ?? 0;
        }
      }
    }

    // 5) compose metrics
    let metrics: ArtistMetrics | null = null;

    const hasAnyMetrics =
      spotify_followers !== null ||
      spotify_popularity !== null ||
      total_releases > 0 ||
      analyzed_versions > 0;

    if (hasAnyMetrics) {
      metrics = {
        spotify_followers,
        spotify_followers_30d_ago,
        spotify_followers_diff_30d,
        spotify_popularity,
        total_releases,
        releases_last_12m,
        analyzed_versions,
        collected_at,
      };
    }

    const rank = computeArtistRank(metrics);

    return {
      artist,
      metrics,
      rank,
      releases,
      error: null,
      artist_slug: artistSlug,
    };
  } catch (err) {
    console.error("[getArtistDetail] unexpected error:", err);
    return {
      artist: null,
      metrics: null,
      rank: null,
      releases: [],
      error: "Errore interno del server",
      artist_slug: null,
    };
  }
}
