import type {
  ArtistMetrics,
  ArtistRank,
  TekkinRankPhase,
} from "@/types/tekkinRank";

/**
 * Calcola il Tekkin Rank a partire dalle metriche reali di un artista.
 *
 * Breakdown e massimali:
 *
 * - growth_score:    0..30   (crescita followers + popularity)
 * - presence_score:  0..25   (followers totali + popularity)
 * - catalog_score:   0..30   (release negli ultimi 12 mesi + catalogo totale)
 * - activity_score:  0..15   (quante versioni sono state analizzate con Tekkin)
 * - analysis_score:  0..100  (media delle valutazioni dell'analyzer, influisce al 40% sul punteggio finale)
 *
 * Il Tekkin Score finale è una media pesata tra le metriche (60%) e l'analisi (40%),
 * con un piccolo boost (+4) se sono presenti dati concreti.
 */
export function computeArtistRank(metrics: ArtistMetrics | null): ArtistRank {
  // Nessuna metrica: artista ancora "vuoto" lato Tekkin.
  if (!metrics) {
    return {
      tekkin_score: 0,
      phase: "building",
      level: "Building phase",
      growth_score: 0,
      presence_score: 0,
      catalog_score: 0,
      activity_score: 0,
      release_score: 0,
      support_score: 0,
      production_score: 0,
      branding_score: 0,
      analysis_score: 0,
    };
  }

  // Normalizzazione input
  const followersNow = metrics.spotify_followers ?? 0;
  const followers30dAgo =
    metrics.spotify_followers_30d_ago ?? metrics.spotify_followers ?? followersNow;

  // Se spotify_followers_diff_30d non è presente, lo ricalcoliamo
  const followersDiff30d =
    metrics.spotify_followers_diff_30d ??
    Math.max(followersNow - followers30dAgo, 0);

  const popularity = metrics.spotify_popularity ?? 0;
  const releasesLast12m = metrics.releases_last_12m ?? 0;
  const totalReleases = metrics.total_releases ?? 0;
  const analyzedVersions = metrics.analyzed_versions ?? 0;

  //
  // 1) GROWTH SCORE (0..30)
  //
  // - 1 punto ogni 20 follower guadagnati negli ultimi 30 giorni, max 20 punti
  // - un contributo moderato dalla popularity, max 10 punti
  //
  const growthFromFollowersRaw = followersDiff30d / 20;
  const growthFromFollowers = Math.min(
    Math.round(growthFromFollowersRaw),
    20
  );

  const growthFromPopularityRaw = popularity / 3; // es: popularity 12 -> 4 punti
  const growthFromPopularity = Math.min(
    Math.round(growthFromPopularityRaw),
    10
  );

  const growth_score = clamp(
    growthFromFollowers + growthFromPopularity,
    0,
    30
  );

  //
  // 2) PRESENCE SCORE (0..25)
  //
  // - followers totali: 1 punto ogni 50 follower, max 20 punti
  // - popularity: 1 punto ogni 10 di popularity, max 5 punti
  //
  const presenceFromFollowersRaw = followersNow / 50;
  const presenceFromFollowers = Math.min(
    Math.round(presenceFromFollowersRaw),
    20
  );

  const presenceFromPopularityRaw = popularity / 10;
  const presenceFromPopularity = Math.min(
    Math.round(presenceFromPopularityRaw),
    5
  );

  const presence_score = clamp(
    presenceFromFollowers + presenceFromPopularity,
    0,
    25
  );

  //
  // 3) CATALOG SCORE (0..30)
  //
  // - releases_last_12m: 1 punto per release negli ultimi 12 mesi, max 20 punti
  // - total_releases: 1 punto ogni 10 release totali, max 10 punti
  //
  const catalogRecentRaw = releasesLast12m;
  const catalogRecent = Math.min(Math.round(catalogRecentRaw), 20);

  const catalogTotalRaw = totalReleases / 10;
  const catalogTotal = Math.min(Math.round(catalogTotalRaw), 10);

  const catalog_score = clamp(catalogRecent + catalogTotal, 0, 30);

  //
  // 4) ACTIVITY SCORE (0..15)
  //
  // - 0 versioni analizzate: 0
  // - 1..2 versioni: 5
  // - 3..5 versioni: 10
  // - >= 6 versioni: 15
  //
  let activity_score = 0;
  if (analyzedVersions > 0 && analyzedVersions <= 2) {
    activity_score = 5;
  } else if (analyzedVersions > 2 && analyzedVersions <= 5) {
    activity_score = 10;
  } else if (analyzedVersions > 5) {
    activity_score = 15;
  }

  //
  // 5) TEKKIN SCORE FINALE (0..100)
  //
  // Somma dei quattro blocchi, con un piccolo boost base per non avere numeri
  // troppo bassi su profili che hanno già attività e catalogo reale.
  //
  const metricsPartial =
    growth_score + presence_score + catalog_score + activity_score;

  const analysisScoreRaw =
    metrics?.analysis_score_average ??
    metrics?.analysis_score_best ??
    metrics?.analysis_score_latest ??
    null;

  const normalizedAnalysisScore =
    analysisScoreRaw !== null ? clamp(analysisScoreRaw, 0, 100) : 0;

  const weightedBase = Math.round(
    metricsPartial * 0.6 + normalizedAnalysisScore * 0.4
  );

  let tekkin_score = weightedBase;

  if (metricsPartial > 0 || normalizedAnalysisScore > 0) {
    tekkin_score += 4;
  }

  tekkin_score = clamp(Math.round(tekkin_score), 0, 100);

  //
  // 6) PHASE E LEVEL TESTUALE
  //
  const phase: TekkinRankPhase =
    tekkin_score < 25
      ? "building"
      : tekkin_score < 50
      ? "rising"
      : tekkin_score < 75
      ? "established"
      : "high_form";

  const level =
    phase === "building"
      ? "Building phase"
      : phase === "rising"
      ? "Rising"
      : phase === "established"
      ? "Established"
      : "High Form";

  return {
    tekkin_score,
    phase,
    level,
    growth_score,
    presence_score,
    catalog_score,
    activity_score,
    release_score: 0,
    support_score: 0,
    production_score: 0,
    branding_score: 0,
    analysis_score: normalizedAnalysisScore,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}
