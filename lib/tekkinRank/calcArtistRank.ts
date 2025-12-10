import { ArtistMetrics, ArtistRank, baseFallbackRank } from "@/types/tekkinRank";

function normalizeLog(
  value: number | null | undefined,
  {
    min = 0,
    max = 1_000_000,
    midScore = 60,
  }: { min?: number; max?: number; midScore?: number } = {}
): number {
  if (value == null || !Number.isFinite(value)) return midScore;

  const clamped = Math.max(min, Math.min(max, value));
  const logMin = Math.log10(min + 10);
  const logMax = Math.log10(max + 10);
  const logVal = Math.log10(clamped + 10);

  const t = (logVal - logMin) / (logMax - logMin); // 0–1
  return Math.round(10 + t * 80); // 10–90
}

function normalizeLinear(
  value: number | null | undefined,
  { min = 0, max = 100, midScore = 60 }: { min?: number; max?: number; midScore?: number } = {}
): number {
  if (value == null || !Number.isFinite(value)) return midScore;
  const clamped = Math.max(min, Math.min(max, value));
  const t = (clamped - min) / (max - min); // 0–1
  return Math.round(10 + t * 80); // 10–90
}

export function calculateArtistRankFromMetrics(
  metrics: ArtistMetrics | null
): ArtistRank {
  if (!metrics) {
    return { ...baseFallbackRank };
  }

  const followersScore = normalizeLog(metrics.spotify_followers, {
    min: 100,
    max: 200_000,
    midScore: 55,
  });

  const monthlyListenersScore = normalizeLog(metrics.spotify_monthly_listeners, {
    min: 500,
    max: 500_000,
    midScore: 60,
  });

  const popularityScore = normalizeLinear(metrics.spotify_popularity, {
    min: 0,
    max: 100,
    midScore: 60,
  });

  const beatportChartsScore = normalizeLinear(
    (metrics.beatport_charts ?? 0) + (metrics.beatport_hype_charts ?? 0),
    { min: 0, max: 30, midScore: 55 }
  );

  const showsScore = normalizeLinear(metrics.shows_last_90_days, {
    min: 0,
    max: 20,
    midScore: 50,
  });

  const weighted =
    followersScore * 0.25 +
    monthlyListenersScore * 0.25 +
    popularityScore * 0.15 +
    beatportChartsScore * 0.2 +
    showsScore * 0.15;

  const tekkin_score = Math.round(Math.max(20, Math.min(95, weighted)));

  let level: ArtistRank["level"];
  if (tekkin_score >= 85) level = "Elite Form";
  else if (tekkin_score >= 70) level = "High Form";
  else if (tekkin_score >= 50) level = "Mid Form";
  else level = "Low Motion";

  const release_score = Math.round(
    followersScore * 0.4 + monthlyListenersScore * 0.4 + popularityScore * 0.2
  );
  const support_score = Math.round(
    beatportChartsScore * 0.6 + popularityScore * 0.4
  );
  const activity_score = Math.round(
    showsScore * 0.7 + followersScore * 0.3
  );
  const branding_score = Math.round(
    popularityScore * 0.7 + followersScore * 0.3
  );

  const production_score = baseFallbackRank.production_score;

  return {
    ...baseFallbackRank,
    tekkin_score,
    level,
    release_score,
    support_score,
    production_score,
    branding_score,
    activity_score,
  };
}
