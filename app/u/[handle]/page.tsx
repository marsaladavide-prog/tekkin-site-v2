import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

import { ArtistProfileHeader } from "@/components/artist/ArtistProfileHeader";
import { ReleasesHighlights } from "@/components/artist/ReleasesHighlights";
import { TekkinRankSection } from "@/components/artist/TekkinRankSection";
import { EditArtistProfileButton } from "@/app/artist/discovery/components/EditArtistProfileButton";
import PublicTracksGallery from "@/components/artist/PublicTracksGallery";
import TopTracksSidebar from "@/components/artist/TopTracksSidebar";

import { getArtistDetail } from "@/lib/artist/discovery/getArtistDetail";
import { toSpotifyEmbedUrl } from "@/utils/spotify";
import type { Artist, ArtistRankView } from "@/types/tekkinRank";
import type { TrackItem } from "@/lib/tracks/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string }>;
};

export default async function PublicArtistPage({ params }: Props) {
  const { handle } = await params;
  const slug = (handle ?? "").trim();
  if (!slug) redirect("/charts");

  const supabase = await createClient();

  const { data: artistRow, error: artistErr } = await supabase
    .from("artists")
    .select("id, slug, user_id, is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (artistErr || !artistRow?.id) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-tekkin-bg">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-tekkin-text">
            Artista non trovato
          </h1>
          <p className="text-sm text-tekkin-muted">
            Controlla il link o riprova più tardi.
          </p>
        </div>
      </main>
    );
  }

  const artistId = artistRow.id as string;

  const detail = await getArtistDetail(artistId);

  const fetchError = detail.error ?? null;
  if (fetchError) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-tekkin-bg">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-tekkin-text">Errore</h1>
          <p className="text-sm text-tekkin-muted">{fetchError}</p>
        </div>
      </main>
    );
  }

  const artist = detail.artist;
  if (!artist) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-tekkin-bg">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-tekkin-text">
            Artista non trovato
          </h1>
          <p className="text-sm text-tekkin-muted">
            Controlla il link o riprova più tardi.
          </p>
        </div>
      </main>
    );
  }

  const projectOwnerId =
    detail.profile_user_id ??
    ((artistRow as any).user_id as string | null) ??
    artistId;

  const genres =
    Array.isArray(artist.main_genres) && artist.main_genres.length > 0
      ? artist.main_genres.filter(Boolean)
      : [];

  const mainGenreLabel = genres[0] ?? null;

  const locationParts = [artist.city, artist.country].filter(Boolean);
  const locationBase =
    locationParts.length > 0 ? locationParts.join(" · ") : null;

  const locationLabel =
    locationBase && artist.open_to_collab
      ? `${locationBase} · Open to collab`
      : locationBase || (artist.open_to_collab ? "Open to collab" : null);

  const instagramUrl = artist.instagram_username
    ? `https://instagram.com/${artist.instagram_username}`
    : null;

  const rankArtist: Artist = {
    id: artist.id,
    artist_name: artist.artist_name ?? "Artista Tekkin",
    artist_photo_url: artist.artist_photo_url,
    artist_genre: mainGenreLabel,
    artist_link_source: undefined,
    spotify_url: artist.spotify_url ?? null,

    beatport_url: artist.beatport_url ?? null,
  };

  const rankView: ArtistRankView | null = detail.rank
    ? { artist: rankArtist, rank: detail.rank as any, metrics: detail.metrics }
    : null;

  const highlightReleases = (detail.releases ?? []).map((rel) => ({
    id: rel.id,
    title: rel.title,
    releaseDate: rel.release_date ?? "",
    coverUrl: rel.cover_url,
    spotifyUrl: toSpotifyEmbedUrl(rel.spotify_url) ?? null,
    albumType: rel.album_type,
  }));

  const admin = createAdminClient();

  // Evitiamo filtri su join (più fragili): carichiamo prima i project dell'owner, poi le versioni public.
  const [
    projectRowsByUserRes,
    projectRowsByArtistRes,
    collabProjectRowsRes,
  ] = await Promise.all([
    admin.from("projects").select("id").eq("user_id", projectOwnerId),
    admin.from("projects").select("id").eq("artist_id", artistId),
    admin.from("project_collaborators").select("project_id").eq("user_id", projectOwnerId),
  ]);

  if (projectRowsByUserRes.error) {
    console.error("[public-artist] projects by user_id error:", projectRowsByUserRes.error);
  }
  if (collabProjectRowsRes.error) {
    console.error("[public-artist] project_collaborators error:", collabProjectRowsRes.error);
  }

  let projectIds =
    projectRowsByUserRes.data
      ?.map((p: any) => p.id)
      .filter((id: any) => typeof id === "string" && id.length > 0) ?? [];


  const collabProjectIds =
    collabProjectRowsRes.data
      ?.map((row: any) => row.project_id)
      .filter((id: any) => typeof id === "string" && id.length > 0) ?? [];

  projectIds = Array.from(new Set([...projectIds, ...collabProjectIds]));

  const ownerByProjectId = new Map<string, string>();
  const collabByProjectId = new Map<string, { id: string; name: string; slug: string | null }[]>();

  if (projectIds.length > 0) {
    const [projectOwnerRowsRes, collabRowsRes] = await Promise.all([
      admin.from("projects").select("id, user_id").in("id", projectIds),
      admin.from("project_collaborators").select("project_id, user_id").in("project_id", projectIds),
    ]);

    if (projectOwnerRowsRes.error) {
      console.error("[public-artist] projects owner error:", projectOwnerRowsRes.error);
    }
    if (collabRowsRes.error) {
      console.error("[public-artist] collaborators lookup error:", collabRowsRes.error);
    }

    projectOwnerRowsRes.data?.forEach((row) => {
      if (row?.id && row?.user_id) ownerByProjectId.set(row.id, row.user_id);
    });

    const collaboratorIds = Array.from(
      new Set(
        (collabRowsRes.data ?? [])
          .map((row) => row?.user_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    const nameByUserId = new Map<string, string>();
    const slugByUserId = new Map<string, string>();

    if (collaboratorIds.length > 0) {
      const [collaboratorProfilesRes, collaboratorSlugsRes] = await Promise.all([
        admin.from("users_profile").select("user_id, artist_name").in("user_id", collaboratorIds),
        admin.from("artists").select("user_id, slug").in("user_id", collaboratorIds),
      ]);

      collaboratorProfilesRes.data?.forEach((row) => {
        if (row?.user_id && typeof row.artist_name === "string" && row.artist_name.trim()) {
          nameByUserId.set(row.user_id, row.artist_name.trim());
        }
      });

      collaboratorSlugsRes.data?.forEach((row) => {
        if (row?.user_id && typeof row.slug === "string" && row.slug.trim()) {
          slugByUserId.set(row.user_id, row.slug.trim());
        }
      });
    }

    (collabRowsRes.data ?? []).forEach((row) => {
      const projectId = row?.project_id;
      const collaboratorId = row?.user_id;
      if (typeof projectId !== "string" || typeof collaboratorId !== "string") return;

      const ownerId = ownerByProjectId.get(projectId);
      if (ownerId && collaboratorId === ownerId) return;

      const name = nameByUserId.get(collaboratorId) ?? "Artista Tekkin";
      const slug = slugByUserId.get(collaboratorId) ?? null;
      const list = collabByProjectId.get(projectId) ?? [];
      list.push({ id: collaboratorId, name, slug });
      collabByProjectId.set(projectId, list);
    });
  }

  const { data: tracks } =
    projectIds.length > 0
      ? await admin
          .from("project_versions")
          .select(
            "id, project_id, version_name, audio_url, visibility, overall_score, waveform_peaks, waveform_bands, waveform_duration, created_at, projects!inner(cover_url)"
          )
          .in("project_id", projectIds)
          .eq("visibility", "public")
          .order("overall_score", { ascending: false })
          .order("created_at", { ascending: false })
      : { data: [] as any[] };

  const versionIds =
    tracks?.map((v: any) => v.id).filter((id: any) => typeof id === "string" && id.length > 0) ?? [];

  const playsByVersionId = new Map<string, number>();
  const likesCountByVersionId = new Map<string, number>();
  const likedSet = new Set<string>();

  if (versionIds.length > 0) {
    const [{ data: counters }, { data: likeCounts }, authRes] = await Promise.all([
      admin.from("tekkin_track_counters").select("version_id, plays").in("version_id", versionIds),
      admin.from("track_likes_counts_v1").select("version_id, likes_count").in("version_id", versionIds),
      supabase.auth.getUser(),
    ]);

    counters?.forEach((c) => {
      playsByVersionId.set(c.version_id, c.plays ?? 0);
    });

    likeCounts?.forEach((r) => {
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

  const resolveProjectCover = (projectData: any): string | null => {
    if (!projectData) return null;
    const meta = Array.isArray(projectData) ? projectData[0] : projectData;
    if (meta && typeof meta.cover_url === "string") {
      return meta.cover_url;
    }
    return null;
  };


  const items: TrackItem[] = (tracks ?? []).map((v: any) => {
    const rawAudio = typeof v.audio_url === "string" ? v.audio_url.trim() : "";
    const audioUrl = rawAudio && rawAudio.startsWith("http") ? rawAudio : null;
    const scoreValue =
      typeof v.overall_score === "number"
        ? v.overall_score
        : typeof v.overall_score === "string"
        ? Number(v.overall_score) || null
        : null;

    const projectId = typeof v.project_id === "string" ? v.project_id : null;
    const ownerId = projectId ? ownerByProjectId.get(projectId) ?? projectOwnerId : projectOwnerId;
    const isOwner = ownerId === projectOwnerId;
    const collabList = projectId ? collabByProjectId.get(projectId) ?? [] : [];
    const collabBadges = isOwner
      ? collabList.map((entry) => ({
          label: `feat. ${entry.name}`,
          href: entry.slug ? `/@${entry.slug}` : null,
        }))
      : [{ label: "Collab" }];

    return {
      versionId: v.id,
      projectId,
      title: v.version_name ?? "Untitled",
      artistName: artist.artist_name,
      artistId: artist.id,
      artistSlug: slug,
      coverUrl: resolveProjectCover(v.projects),
      audioUrl,
      waveformPeaks: Array.isArray(v.waveform_peaks) ? v.waveform_peaks : null,
      waveformBands: v.waveform_bands ?? null,
      waveformDuration:
        typeof v.waveform_duration === "number" && Number.isFinite(v.waveform_duration)
          ? v.waveform_duration
          : null,
      scorePublic: scoreValue,
      plays: playsByVersionId.get(v.id) ?? 0,
      likesCount: likesCountByVersionId.get(v.id) ?? 0,
      likedByMe: likedSet.has(v.id),
      collabBadges: collabBadges.length > 0 ? collabBadges : null,
    };
  });

  const QUALITY_MULTIPLIER = 5;
  const topTracks = (tracks ?? [])
    .map((v: any) => {
      const baseScore =
        typeof v.overall_score === "number"
          ? v.overall_score
          : typeof v.overall_score === "string"
          ? Number(v.overall_score) || null
          : null;
      const scorePublic = typeof baseScore === "number" ? Math.round(baseScore * QUALITY_MULTIPLIER) : null;
      const item = items.find((entry) => entry.versionId === v.id);
      return item
        ? {
            ...item,
            scorePublic,
            rankScore: baseScore ?? -1,
            createdAt: typeof v.created_at === "string" ? v.created_at : null,
          }
        : null;
    })
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .sort((a, b) => {
      const scoreDiff = (b.rankScore ?? -1) - (a.rankScore ?? -1);
      if (scoreDiff !== 0) return scoreDiff;
      const aDate = Date.parse(a.createdAt ?? "") || 0;
      const bDate = Date.parse(b.createdAt ?? "") || 0;
      return bDate - aDate;
    })
    .slice(0, 10)
    .map((t, index) => ({ ...t, rankPosition: index + 1 }));

  return (
    <main className="flex-1 min-h-screen bg-tekkin-bg px-4 py-6 md:px-10 md:py-8">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <ArtistProfileHeader
          artistId={artistId}
          artistName={artist.artist_name || "Artista Tekkin"}
          mainGenreLabel={mainGenreLabel}
          locationLabel={locationLabel}
          avatarUrl={artist.artist_photo_url}
          spotifyUrl={toSpotifyEmbedUrl(artist.spotify_url) ?? null}
          beatportUrl={artist.beatport_url ?? null}
          instagramUrl={instagramUrl}
          presskitUrl={artist.presskit_link ?? null}
        />

        <div className="flex justify-center mt-2">
          <EditArtistProfileButton artistId={artist.id} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <TekkinRankSection overrideData={rankView ?? undefined} />
          <TopTracksSidebar tracks={topTracks} artistId={artist.id} />
        </div>

        <div className="space-y-5">
          <ReleasesHighlights releases={highlightReleases} />

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-xs font-mono uppercase tracking-[0.16em] text-tekkin-muted">
                  Tracce pubbliche
                </h2>
                <p className="text-xs text-tekkin-text/70">
                  {items.length > 0
                    ? `${items.length} tracce pubblicate su Tekkin`
                    : "Nessuna traccia pubblica al momento."}
                </p>
              </div>
            </div>

            {items.length > 0 && (
              <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">
                Vedi solo le versioni analizzate e pronte alla ribalta.
              </p>
            )}

            {items.length > 0 ? (
              <PublicTracksGallery items={items} />
            ) : (
              <p className="text-xs text-tekkin-muted">
                Le nuove release pubbliche appariranno qui.
              </p>
            )}
          </section>
        </div>

        {genres.length > 1 && (
          <section className="space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-[0.16em] text-tekkin-muted">
              Generi
            </h2>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
              {genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 rounded-full border border-tekkin-border text-tekkin-muted uppercase tracking-[0.14em]"
                >
                  {genre.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-[0.16em] text-tekkin-muted">
            Bio
          </h2>
          <p className="text-sm leading-relaxed text-tekkin-text/90 whitespace-pre-line">
            {artist.bio_short || "Nessuna bio inserita."}
          </p>
        </section>
      </div>
    </main>
  );
}
