"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Artist = {
  id: string;
  artist_name: string;
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

export function useArtistRank() {
  const fallbackData: ArtistRankView = {
    artist: { id: "fallback", artist_name: "Tekkin Artist" },
    rank: {
      tekkin_score: 74,
      level: "High Form",
      release_score: 70,
      support_score: 68,
      production_score: 72,
      branding_score: 66,
      activity_score: 64,
    },
    metrics: {
      spotify_monthly_listeners: 0,
      spotify_streams_total: 48000,
      spotify_streams_change: 12,
      beatport_charts: 2,
      beatport_hype_charts: 1,
      shows_last_90_days: 14,
      shows_total: 0,
      collected_at: new Date().toISOString(),
    },
  };

  const [data, setData] = useState<ArtistRankView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // 1) se supabase non è configurato (env mancanti) → fallback demo
    if (!supabase) {
      console.warn("Supabase non configurato. Uso Tekkin Rank fallback.");
      setData(fallbackData);
      setError(null);
      setLoading(false);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // 2) utente loggato?
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) {
          throw new Error("Utente non autenticato");
        }

        // 3) artista collegato
        const { data: artist, error: artistErr } = await supabase
          .from("artists")
          .select("id, artist_name")
          .eq("user_id", user.id)
          .single();

        if (artistErr || !artist) {
          throw new Error("Profilo artista non trovato");
        }

        // 4) rank
        const { data: rank, error: rankErr } = await supabase
          .from("artist_rank")
          .select(
            "tekkin_score, level, release_score, support_score, production_score, branding_score, activity_score"
          )
          .eq("artist_id", artist.id)
          .single();

        if (rankErr || !rank) {
          throw new Error("Tekkin Rank non trovato");
        }

        // 5) ultimo snapshot metrics
        const { data: metricsRows, error: metricsErr } = await supabase
          .from("artist_metrics_daily")
          .select(
            "spotify_monthly_listeners, spotify_streams_total, spotify_streams_change, beatport_charts, beatport_hype_charts, shows_last_90_days, shows_total, collected_at"
          )
          .eq("artist_id", artist.id)
          .order("collected_at", { ascending: false })
          .limit(1);

        if (metricsErr) {
          throw metricsErr;
        }

        const metrics =
          metricsRows && metricsRows.length > 0
            ? (metricsRows[0] as ArtistMetrics)
            : null;

        setData({
          artist,
          rank: rank as ArtistRank,
          metrics,
        });
      } catch (err: any) {
        console.error("useArtistRank error", err);
        // fallback demo per non bucare la UI
        setError(null);
        setData(fallbackData);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { data, loading, error };
}
