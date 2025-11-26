"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Artist = {
  id: string;
  user_id?: string;
  artist_name: string;
  artist_photo_url?: string | null;
  artist_genre?: string | null;
  artist_link_source?: string | null;

  spotify_id?: string | null;
  spotify_url?: string | null;
  beatstats_url?: string | null;
  beatport_url?: string | null;
  instagram_url?: string | null;
  soundcloud_url?: string | null;
  traxsource_url?: string | null;
  songstats_url?: string | null;
  resident_advisor_url?: string | null;
  songkick_url?: string | null;
  apple_music_url?: string | null;
  tidal_url?: string | null;

  socials?: {
    spotify?: string | null;
    beatport?: string | null;
    beatstats?: string | null;
    instagram?: string | null;
    soundcloud?: string | null;
  };
};

type ArtistRank = {
  tekkin_score: number;
  level: string;
  release_score: number;
  support_score: number;
  production_score: number;
  branding_score: number;
  activity_score: number;
};

type ArtistMetrics = {
  spotify_monthly_listeners: number | null;
  spotify_streams_total: number | null;
  spotify_streams_change: number | null;
  spotify_followers: number | null;
  spotify_popularity: number | null;
  beatport_charts: number | null;
  beatport_hype_charts: number | null;
  shows_last_90_days: number | null;
  shows_total: number | null;
  collected_at: string;
};

export type ArtistRankView = {
  artist: Artist;
  rank: ArtistRank;
  metrics: ArtistMetrics | null;
};

const baseFallbackRank: ArtistRank = {
  tekkin_score: 74,
  level: "High Form",
  release_score: 70,
  support_score: 68,
  production_score: 72,
  branding_score: 66,
  activity_score: 64,
};

function toNumber(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function useArtistRank() {
  const [data, setData] = useState<ArtistRankView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // profilo salvato da /register in localStorage
  const [localProfile] = useState<Record<string, any>>(() => {
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

        const metaSpotifyFromLink =
          typeof meta.artist_link_source === "string" &&
          meta.artist_link_source.includes("spotify.com/artist")
            ? meta.artist_link_source
            : null;

        // artista collegato da tabella artists
        const { data: artistRow, error: artistErr } = await supabase
          .from("artists")
          .select(
            "id,user_id,artist_name,artist_photo_url,artist_genre,artist_link_source,spotify_id,spotify_url,instagram_url,beatport_url,beatstats_url,soundcloud_url"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        // Se la query non restituisce righe potremmo avere un errore vuoto; non logghiamo per evitare rumore in console

        const genreFromTable =
          artistRow && typeof (artistRow as any).artist_genre === "string"
            ? ((artistRow as any).artist_genre as string)
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

        const instagramUrl =
          (artistRow?.instagram_url as string) ||
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

          artist_name:
            artistRow?.artist_name ||
            metaName ||
            (localProfile.artist_name as string | undefined) ||
            "Tekkin Artist",

          artist_photo_url:
            (artistRow?.artist_photo_url as string | undefined) ||
            metaPhoto ||
            (localProfile.artist_photo_url as string | undefined) ||
            "/images/default-artist.png",

          artist_genre:
            genreFromTable ||
            metaGenre ||
            (localProfile.artist_genre as string | undefined) ||
            "Artist",

          artist_link_source:
            (artistRow?.artist_link_source as string | undefined) ||
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
          spotify_popularity:
            toNumber(localProfile.spotify_popularity) ??
            toNumber(localProfile.popularity) ??
            toNumber(meta.spotify_popularity) ??
            null,
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
          collected_at: new Date().toISOString(),
        };

        console.log("tekkin_artist_profile local:", localProfile);
        console.log("metricsFromProfile:", metricsFromProfile);

        if (isMounted) {
          setData({
            artist: artistProfile,
            rank: baseFallbackRank,
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
  }, [localProfile]);

  return { data, loading, error };
}
