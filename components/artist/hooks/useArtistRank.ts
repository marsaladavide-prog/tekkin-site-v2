"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { computeArtistRank } from "@/lib/tekkin/computeArtistRank";

import { Artist, ArtistMetrics, ArtistRankView } from "@/types/tekkinRank";

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function useArtistRank() {
  const [data, setData] = useState<ArtistRankView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // profilo salvato da /register in localStorage
  const [localProfile] = useState<Record<string, unknown>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("tekkin_artist_profile");
      const parsed = raw ? JSON.parse(raw) : {};
      // per debug, se serve
      // console.log("localProfile tekkin_artist_profile:", parsed);
      return parsed;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const handleRefresh = () => setRefreshKey((prev) => prev + 1);
    if (typeof window !== "undefined") {
      window.addEventListener("tekkin:artist-updated", handleRefresh);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("tekkin:artist-updated", handleRefresh);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        let supabase;
        try {
          supabase = createClient();
        } catch (err: any) {
          console.warn("Supabase client init failed, using fallback", err);
          if (isMounted) {
            setData(null);
            setLoading(false);
          }
          return;
        }

        // utente loggato
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) {
          console.warn("useArtistRank: user not authenticated, no data");
          if (isMounted) {
            setData(null);
            setLoading(false);
          }
          return;
        }

        const meta = (user.user_metadata as Record<string, any>) || {};
        const metaName = (meta.artist_name as string) || null;
        const metaPhoto =
          (meta.artist_image_url as string) ||
          (meta.artist_photo_url as string) ||
          (meta.imageUrl as string) ||
          (meta.avatar_url as string) ||
          null;
        const metaGenre = (meta.artist_genre as string) || null;
        const metaSlug =
          (meta.artist_slug as string) ||
          (meta.slug as string) ||
          null;

        const metaSpotifyFromLink =
          typeof meta.artist_link_source === "string" &&
          meta.artist_link_source.includes("spotify.com/artist")
            ? meta.artist_link_source
            : null;

        // artista collegato da tabella artists
        const { data: artistRow, error: _artistErr } = await supabase
          .from("artists")
          .select(
            "id,user_id,slug,artist_name,spotify_id,spotify_url,beatport_url,beatstats_url,soundcloud_url,source_link,main_genre,ig_username,ig_profile_picture"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        const { data: profileRow } = await supabase
          .from("users_profile")
          .select("photo_url, artist_name")
          .eq("user_id", user.id)
          .maybeSingle();

        const profileArtistName =
          typeof profileRow?.artist_name === "string" && profileRow.artist_name.trim()
            ? profileRow.artist_name.trim()
            : null;

        // Se la query non restituisce righe potremmo avere un errore vuoto; non logghiamo per evitare rumore in console

        const genreFromTable =
          artistRow && typeof (artistRow as any).main_genre === "string"
            ? ((artistRow as any).main_genre as string)
            : null;

        const spotifyId =
          (artistRow?.spotify_id as string) ||
          (meta.spotify_id as string) ||
          (localProfile.spotify_id as string | undefined) ||
          null;

        const spotifyUrl =
          (artistRow?.spotify_url as string) ||
          metaSpotifyFromLink ||
          (meta.spotify_url as string) ||
          (localProfile.spotify_url as string | undefined) ||
          null;

        const beatportUrl =
          (artistRow?.beatport_url as string) ||
          (meta.beatport_url as string) ||
          (localProfile.beatport_url as string | undefined) ||
          null;

        const beatstatsUrl =
          (artistRow?.beatstats_url as string) ||
          (meta.beatstats_url as string) ||
          (localProfile.beatstats_url as string | undefined) ||
          null;

        const instagramHandle =
          (artistRow?.ig_username as string) || null;
        const instagramUrl =
          (instagramHandle ? `https://instagram.com/${instagramHandle}` : null) ||
          (meta.instagram_url as string) ||
          (localProfile.instagram_url as string | undefined) ||
          null;

        const soundcloudUrl =
          (artistRow?.soundcloud_url as string) ||
          (meta.soundcloud_url as string) ||
          (localProfile.soundcloud_url as string | undefined) ||
          null;

        const artistProfile: Artist = {
          id: artistRow?.id || user.id,
          user_id: artistRow?.user_id,
          artist_slug:
            artistRow?.slug ||
            metaSlug ||
            (localProfile.artist_slug as string | undefined) ||
            (localProfile.slug as string | undefined) ||
            null,

          artist_name:
            profileArtistName ||
            artistRow?.artist_name ||
            metaName ||
            (localProfile.artist_name as string | undefined) ||
            "Tekkin Artist",

          artist_photo_url:
            (artistRow?.ig_profile_picture as string | undefined) ||
            (profileRow?.photo_url as string | undefined) ||
            metaPhoto ||
            (localProfile.artist_photo_url as string | undefined) ||
            "/images/default-artist.png",

          artist_genre:
            genreFromTable ||
            metaGenre ||
            (localProfile.artist_genre as string | undefined) ||
            "Artist",

          artist_link_source:
            (artistRow?.source_link as string | undefined) ||
            (meta.artist_link_source as string) ||
            null,

          spotify_id: spotifyId,
          spotify_url: spotifyUrl,
          beatport_url: beatportUrl,
          beatstats_url: beatstatsUrl,
          instagram_url: instagramUrl,
          soundcloud_url: soundcloudUrl,

          traxsource_url:
            (meta.traxsource_url as string) ||
            (localProfile.traxsource_url as string | null) ||
            null,
          songstats_url:
            (meta.songstats_url as string) ||
            (localProfile.songstats_url as string | null) ||
            null,
          resident_advisor_url:
            (meta.resident_advisor_url as string) ||
            (localProfile.resident_advisor_url as string | null) ||
            null,
          songkick_url:
            (meta.songkick_url as string) ||
            (localProfile.songkick_url as string | null) ||
            null,
          apple_music_url:
            (meta.apple_music_url as string) ||
            (localProfile.apple_music_url as string | null) ||
            null,
          tidal_url:
            (meta.tidal_url as string) ||
            (localProfile.tidal_url as string | null) ||
            null,

          socials: {
            spotify: spotifyUrl,
            beatport: beatportUrl,
            beatstats: beatstatsUrl,
            instagram: instagramUrl,
            soundcloud: soundcloudUrl,
          },
        };

        // qui leggiamo i numeri dallo scan Spotify salvato in localStorage
        const metricsFromProfile: ArtistMetrics = {
          spotify_monthly_listeners:
            toNumber(localProfile.spotify_monthly_listeners) ??
            toNumber(meta.spotify_monthly_listeners) ??
            null,
          spotify_streams_total:
            toNumber(localProfile.spotify_streams_total) ??
            toNumber(meta.spotify_streams_total) ??
            null,
          spotify_streams_change:
            toNumber(localProfile.spotify_streams_change) ??
            toNumber(meta.spotify_streams_change) ??
            null,
          spotify_followers:
            toNumber(localProfile.spotify_followers) ??
            toNumber(localProfile.followers) ??
            toNumber(meta.spotify_followers) ??
            null,
          spotify_followers_30d_ago:
            toNumber(localProfile.spotify_followers_30d_ago) ??
            toNumber(meta.spotify_followers_30d_ago) ??
            null,
          spotify_followers_diff_30d:
            toNumber(localProfile.spotify_followers_diff_30d) ??
            toNumber(meta.spotify_followers_diff_30d) ??
            null,
          spotify_popularity:
            toNumber(localProfile.spotify_popularity) ??
            toNumber(localProfile.popularity) ??
            toNumber(meta.spotify_popularity) ??
            null,
          total_releases:
            toNumber(localProfile.total_releases) ??
            toNumber(meta.total_releases) ??
            0,
          releases_last_12m:
            toNumber(localProfile.releases_last_12m) ??
            toNumber(meta.releases_last_12m) ??
            0,
          beatport_charts:
            toNumber(localProfile.beatport_charts) ??
            toNumber(meta.beatport_charts) ??
            null,
          beatport_hype_charts:
            toNumber(localProfile.beatport_hype_charts) ??
            toNumber(meta.beatport_hype_charts) ??
            null,
          shows_last_90_days:
            toNumber(localProfile.shows_last_90_days) ??
            toNumber(meta.shows_last_90_days) ??
            null,
          shows_total:
            toNumber(localProfile.shows_total) ??
            toNumber(meta.shows_total) ??
            null,
          analyzed_versions:
            toNumber(localProfile.analyzed_versions) ??
            toNumber(meta.analyzed_versions) ??
            0,
          analysis_score_average: null,
          analysis_score_best: null,
          analysis_score_latest: null,
          analysis_score_count: 0,
          collected_at: new Date().toISOString(),
        };

        console.log("tekkin_artist_profile local:", localProfile);
        console.log("metricsFromProfile:", metricsFromProfile);

        if (isMounted) {
          const calculatedRank = computeArtistRank(metricsFromProfile);

          setData({
            artist: artistProfile,
    rank: calculatedRank,
    metrics: metricsFromProfile,
  });
}
      } catch (err: any) {
        console.error("useArtistRank error", err);
        if (isMounted) {
          setError(err.message || "Errore useArtistRank");
          setData(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [localProfile, refreshKey]);

  return { data, loading, error };
}
