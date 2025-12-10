import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/api/artist/profile";
import { ArtistMetrics, ArtistRank } from "@/types/tekkinRank";
import { computeArtistRank } from "@/lib/tekkin/computeArtistRank";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ArtistDiscoveryDetailResponse = {
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
  rank: ArtistRank; // ← nuovo
  releases?: {
    id: string;
    title: string;
    release_date: string | null;
    cover_url: string | null;
    spotify_url: string | null;
    album_type: string | null;
  }[];
};


export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const { artistId } = await params;

  if (!artistId || !uuidRegex.test(artistId)) {
    return NextResponse.json(
      { error: "ID artista non valido" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1) PROFILO ARTISTA (users_profile)
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
      console.error("[GET /api/artist/discovery/:id] supabase error:", error);
      return NextResponse.json(
        { error: "Errore caricando l'artista" },
        { status: 500 }
      );
    }

    let profileData = data;

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
        console.error(
          "[GET /api/artist/discovery/:id] artists lookup error:",
          artistErr
        );
      }

      if (artistRow) {
        profileData = {
          id: artistRow.id,
          user_id: artistRow.user_id ?? artistRow.id,
          artist_name: artistRow.artist_name,
          avatar_url: artistRow.artist_photo_url,
          photo_url: artistRow.artist_photo_url,
          main_genres: artistRow.artist_genre
            ? [artistRow.artist_genre]
            : [],
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
      console.warn(
        "[GET /api/artist/discovery/:id] profile not found for",
        artistId
      );
      return NextResponse.json(
        { error: "Artista non trovato" },
        { status: 404 }
      );
    }

    const profileRow = profileData;
    const profileId = profileRow.id;
    const profileUserId = profileRow.user_id ?? profileId;

    const artist = {
      id: profileRow.id,
      artist_name: profileRow.artist_name,
      artist_photo_url:
        profileRow.avatar_url ?? profileRow.photo_url ?? null,
      main_genres: Array.isArray(profileRow.main_genres)
        ? profileRow.main_genres
        : profileRow.main_genres
        ? [profileRow.main_genres]
        : [],
      bio_short: profileRow.bio_short,
      city: profileRow.city,
      country: profileRow.country,
      open_to_collab: profileRow.open_to_collab ?? false,
      spotify_url: profileRow.spotify_url ?? null,
      instagram_username: profileRow.instagram_username ?? null,
      beatport_url: profileRow.beatport_url ?? null,
      presskit_link: profileRow.presskit_link ?? null,
    };

    // 2) METRICHE SPOTIFY (ultimi ~30 punti, per followers 30d e popularity)
    const { data: metricsRows, error: metricsErr } = await supabase
      .from("artist_metrics_daily")
      .select(
        `
        spotify_followers,
        spotify_popularity,
        collected_at
      `
      )
      .eq("artist_id", profileId)
      .order("collected_at", { ascending: false })
      .limit(30);

    if (metricsErr) {
      console.error(
        "[GET /api/artist/discovery/:id] metrics error:",
        metricsErr
      );
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
      spotify_followers_30d_ago =
        oldest.spotify_followers ?? spotify_followers;
      if (
        spotify_followers !== null &&
        spotify_followers_30d_ago !== null
      ) {
        spotify_followers_diff_30d = Math.max(
          spotify_followers - spotify_followers_30d_ago,
          0
        );
      } else {
        spotify_followers_diff_30d = null;
      }

      spotify_popularity = latest.spotify_popularity ?? null;
      collected_at = latest.collected_at ?? null;
    }

    // 3) RELEASES SPOTIFY (per catalogo + releases_last_12m)
    const { data: releasesRows, error: releasesErr } = await supabase
      .from("artist_spotify_releases")
      .select(
        `
        id,
        title,
        release_date,
        cover_url,
        spotify_url,
        album_type,
        position
      `
      )
      .eq("artist_id", profileId)
      .order("position", { ascending: true });

    if (releasesErr) {
      console.error(
        "[GET /api/artist/discovery/:id] releases error:",
        releasesErr
      );
    }

    const releases =
      releasesRows?.map((r) => ({
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
      releasesRows?.filter((r) => {
        if (!r.release_date) return false;
        const d = new Date(r.release_date as string);
        return d >= cutoff;
      }).length ?? 0;

    // 4) ATTIVITÀ TEKKIN (versioni analizzate)
    let analyzed_versions = 0;

    const { data: projectIdRows, error: projectIdErr } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", profileUserId);

    if (projectIdErr) {
      console.error(
        "[GET /api/artist/discovery/:id] project ids error:",
        projectIdErr
      );
    } else {
      const projectIds = projectIdRows?.map((row) => row.id) ?? [];

      if (projectIds.length > 0) {
        const { data: versionsRows, error: versionsErr } = await supabase
          .from("project_versions")
          .select("id")
          .in("project_id", projectIds)
          .not("analyzer_json", "is", null);

        if (versionsErr) {
          console.error(
            "[GET /api/artist/discovery/:id] versions error:",
            versionsErr
          );
        } else {
          analyzed_versions = versionsRows?.length ?? 0;
        }
      }
    }

    // 5) COMPOSIZIONE ArtistMetrics (nuovo schema)
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

    // Tekkin Rank calcolato dai dati reali
    const rank = computeArtistRank(metrics);

        return NextResponse.json<ArtistDiscoveryDetailResponse>({
          artist,
          metrics,
          rank,
          releases,
        });
      } catch (err) {
        console.error("[GET /api/artist/discovery/:id] unexpected error:", err);
        return NextResponse.json(
          { error: "Errore interno del server" },
          { status: 500 }
        );
      }
    }
