import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

import { ArtistProfileHeader } from "@/components/artist/ArtistProfileHeader";
import { ReleasesHighlights } from "@/components/artist/ReleasesHighlights";
import { TekkinRankSection } from "@/components/artist/TekkinRankSection";
import { EditArtistProfileButton } from "@/app/artist/discovery/components/EditArtistProfileButton";
import PublicTracksGallery from "@/components/artist/PublicTracksGallery";

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
  const { data: projectRowsByUser, error: projectRowsByUserErr } = await admin
    .from("projects")
    .select("id")
    .eq("user_id", projectOwnerId);

  if (projectRowsByUserErr) {
    console.error("[public-artist] projects by user_id error:", projectRowsByUserErr);
  }

  let projectIds =
    projectRowsByUser?.map((p: any) => p.id).filter((id: any) => typeof id === "string" && id.length > 0) ?? [];

  // Fallback: alcuni dati legacy possono legare i project a `artist_id` invece che `user_id`.
  if (projectIds.length === 0) {
    const { data: projectRowsByArtist, error: projectRowsByArtistErr } = await admin
      .from("projects")
      .select("id")
      .eq("artist_id", artistId);

    if (projectRowsByArtistErr) {
      console.error("[public-artist] projects by artist_id error:", projectRowsByArtistErr);
    } else {
      projectIds =
        projectRowsByArtist?.map((p: any) => p.id).filter((id: any) => typeof id === "string" && id.length > 0) ?? [];
    }
  }

const { data: tracks } =
  projectIds.length > 0
    ? await admin
        .from("project_versions")
        .select(
          "id, project_id, version_name, audio_url, visibility, overall_score, waveform_peaks, waveform_bands, waveform_duration, projects!inner(cover_url)"
        )
        .in("project_id", projectIds)
        .eq("visibility", "public")
        .order("overall_score", { ascending: false })
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

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

  return {
    versionId: v.id,
    projectId: typeof v.project_id === "string" ? v.project_id : null,
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
    likesCount: 0,
    likedByMe: false,
  };
});


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

        <TekkinRankSection overrideData={rankView ?? undefined} />

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
