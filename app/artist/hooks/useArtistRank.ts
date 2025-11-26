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

export function useArtistRank() {
  const [data, setData] = useState<ArtistRankView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [localProfile] = useState<Partial<Artist>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("tekkin_artist_profile");
      return raw ? (JSON.parse(raw) as Partial<Artist>) : {};
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

        // 1) utente loggato
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

        // 2) artista collegato: USA SOLO COLONNE CHE ESISTONO DAVVERO
        const { data: artistRow, error: artistErr } = await supabase
          .from("artists")
          .select(
            "id,user_id,artist_name,genres,source_link,spotify_id,spotify_url,beatport_url,beatstats_url,instagram_url,soundcloud_url"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (artistErr) {
          console.error("useArtistRank artists error", artistErr);
        }

        // genere dal campo genres (array) se presente
        const genreFromTable =
          artistRow &&
          Array.isArray((artistRow as any).genres) &&
          (artistRow as any).genres.length > 0
            ? (artistRow as any).genres[0]
            : null;

        // spotify
        const spotifyId =
          (artistRow?.spotify_id as string) ||
          (meta.spotify_id as string) ||
          ((localProfile as any).spotify_id as string | undefined) ||
          null;

        const spotifyUrl =
          (artistRow?.spotify_url as string) ||
          metaSpotifyFromLink ||
          (meta.spotify_url as string) ||
          ((localProfile as any).spotify_url as string | undefined) ||
          null;

        // altri social
        const beatportUrl =
          (artistRow?.beatport_url as string) ||
          (meta.beatport_url as string) ||
          ((localProfile as any).beatport_url as string | undefined) ||
          null;

        const beatstatsUrl =
          (artistRow?.beatstats_url as string) ||
          (meta.beatstats_url as string) ||
          ((localProfile as any).beatstats_url as string | undefined) ||
          null;

        const instagramUrl =
          (artistRow?.instagram_url as string) ||
          (meta.instagram_url as string) ||
          ((localProfile as any).instagram_url as string | undefined) ||
          null;

        const soundcloudUrl =
          (artistRow?.soundcloud_url as string) ||
          (meta.soundcloud_url as string) ||
          ((localProfile as any).soundcloud_url as string | undefined) ||
          null;

        const artistProfile: Artist = {
          id: artistRow?.id || user.id,
          user_id: artistRow?.user_id,

          artist_name:
            artistRow?.artist_name ||
            metaName ||
            localProfile.artist_name ||
            "Tekkin Artist",

          // foto solo da meta / local
          artist_photo_url:
            metaPhoto ||
            localProfile.artist_photo_url ||
            "/images/default-artist.png",

          // genere: meta → tabella (genres[0]) → local → default
          artist_genre:
            metaGenre ||
            genreFromTable ||
            localProfile.artist_genre ||
            "Artist",

          // link sorgente: artists.source_link oppure meta.artist_link_source
          artist_link_source:
            (artistRow?.source_link as string | undefined) ||
            (meta.artist_link_source as string) ||
            null,

          // raw socials “ufficiali”
          spotify_id: spotifyId,
          spotify_url: spotifyUrl,
          beatport_url: beatportUrl,
          beatstats_url: beatstatsUrl,
          instagram_url: instagramUrl,
          soundcloud_url: soundcloudUrl,

          // questi li teniamo solo lato meta/local per ora
          traxsource_url:
            (meta.traxsource_url as string) ||
            ((localProfile as any).traxsource_url as string | null) ||
            null,
          songstats_url:
            (meta.songstats_url as string) ||
            ((localProfile as any).songstats_url as string | null) ||
            null,
          resident_advisor_url:
            (meta.resident_advisor_url as string) ||
            ((localProfile as any).resident_advisor_url as string | null) ||
            null,
          songkick_url:
            (meta.songkick_url as string) ||
            ((localProfile as any).songkick_url as string | null) ||
            null,
          apple_music_url:
            (meta.apple_music_url as string) ||
            ((localProfile as any).apple_music_url as string | null) ||
            null,
          tidal_url:
            (meta.tidal_url as string) ||
            ((localProfile as any).tidal_url as string | null) ||
            null,

          // socials che legge ArtistHero
          socials: {
            spotify: spotifyUrl,
            beatport: beatportUrl,
            beatstats: beatstatsUrl,
            instagram: instagramUrl,
            soundcloud: soundcloudUrl,
          },
        };

      // metriche base (fake) per far vivere il componente TekkinRankSection
        const metricsFromMeta: ArtistMetrics = {
          spotify_monthly_listeners:
            (meta.spotify_monthly_listeners as number | undefined) ?? null,
          spotify_streams_total:
            (meta.spotify_streams_total as number | undefined) ?? null,
          spotify_streams_change:
            (meta.spotify_streams_change as number | undefined) ?? null,
          spotify_followers:
            (meta.spotify_followers as number | undefined) ?? null,
          spotify_popularity:
            (meta.spotify_popularity as number | undefined) ?? null,
          beatport_charts:
            (meta.beatport_charts as number | undefined) ?? null,
          beatport_hype_charts:
            (meta.beatport_hype_charts as number | undefined) ?? null,
          shows_last_90_days:
            (meta.shows_last_90_days as number | undefined) ?? null,
          shows_total:
            (meta.shows_total as number | undefined) ?? null,
          collected_at: new Date().toISOString(),
        };

        if (isMounted) {
          setData({
            artist: artistProfile,
            rank: baseFallbackRank, // per ora fake
            metrics: metricsFromMeta, // mai null, al massimo pieno di null
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
