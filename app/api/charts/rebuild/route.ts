import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEKKIN_CRON_SECRET = process.env.TEKKIN_CRON_SECRET;

const PROFILE_VERSIONS_TABLE = "tekkin_charts_profile_versions";
const METRICS_TABLE = "tekkin_charts_metrics_total";
const SNAPSHOT_TABLE = "tekkin_charts_snapshots";
const PROJECTS_TABLE = "projects";
const ARTISTS_TABLE = "artists";

const METRIC_CHUNK_SIZE = 200;
const ARTIST_CHUNK_SIZE = 500;

type RankProfileConfig = {
  refs?: {
    likes?: number;
    plays?: number;
    downloads?: number;
  };
  weights?: {
    analyzer?: number;
    likes?: number;
    plays?: number;
    downloads?: number;
  };
  public_multiplier?: number;
};

type ProfileVersionRow = {
  id: number;
  profile_key: string;
  config: RankProfileConfig | null;
  created_at: string | null;
};

type ProjectRow = {
  id: string;
  user_id: string;
  title: string | null;
  cover_url: string | null;
  genre: string | null;
  mix_type: string | null;
};

type LatestProjectVersionRow = {
  project_id: string;
  version_id: string;
  created_at: string | null;
  audio_url: string | null;
  audio_path: string | null;
  overall_score: number | null;
  visibility: string | null;
  version_mix_type: string | null;
};

type ArtistRow = {
  id: string;
  artist_name: string | null;
};

type RankingCandidate = {
  projectId: string;
  versionId: string;
  artistId: string;
  analyzerScore: number;
  likesTotal: number;
  playsTotal: number;
  downloadsTotal: number;
  visibility: string | null;
  versionCreatedAt: string | null;
  updatedAt: string;
  metadata: {
    trackTitle: string | null;
    artistName: string | null;
    coverUrl: string | null;
    genre: string | null;
    mixType: string | null;
    audioUrl: string | null;
  };
};

type MetricsRow = {
  version_id: string;
  project_id: string;
  artist_id: string;
  analyzer_score_0_100: number;
  likes_total: number;
  plays_total: number;
  signal_downloads_total: number;
  visibility: string | null;
  release_date: string | null;
  updated_at: string;
};

type ScoreResult = {
  score: number;
  scorePublic: number;
};

type ScoreFunction = (candidate: RankingCandidate) => ScoreResult;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getWeekPeriod(reference: Date): { start: Date; end: Date } {
  const copy = new Date(reference);
  const dayOfWeek = copy.getUTCDay();
  const shift = (dayOfWeek + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - shift);
  copy.setUTCHours(0, 0, 0, 0);
  const start = new Date(copy);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start, end };
}

function parseDateValue(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return formatDateOnly(parsed);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normMetric(value: number, reference: number): number {
  const baseRef = reference > 0 ? reference : 1;
  if (value <= 0) {
    return 0;
  }
  const numerator = 100 * Math.log(1 + value);
  const denominator = Math.log(1 + baseRef);
  if (!Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return clamp(numerator / denominator, 0, 100);
}

function computeGlobalScore(candidate: RankingCandidate, config: RankProfileConfig | null): ScoreResult {
  const weights = config?.weights;
  const refs = config?.refs;
  const analyzer = clamp(candidate.analyzerScore ?? 0, 0, 100);
  const likesNorm = normMetric(candidate.likesTotal, refs?.likes ?? 200);
  const playsNorm = normMetric(candidate.playsTotal, refs?.plays ?? 3000);
  const downloadsNorm = normMetric(candidate.downloadsTotal, refs?.downloads ?? 30);

  const score =
    (weights?.analyzer ?? 0.55) * analyzer +
    (weights?.likes ?? 0.2) * likesNorm +
    (weights?.plays ?? 0.15) * playsNorm +
    (weights?.downloads ?? 0.1) * downloadsNorm;

  const clamped = clamp(score, 0, 100);
  const multiplier = config?.public_multiplier ?? 5;
  const scorePublic = Math.round(clamped * multiplier);
  return {
    score: clamped,
    scorePublic,
  };
}

function computeQualityScore(candidate: RankingCandidate, config: RankProfileConfig | null): ScoreResult {
  const analyzer = clamp(candidate.analyzerScore ?? 0, 0, 100);
  const multiplier = config?.public_multiplier ?? 5;
  return {
    score: analyzer,
    scorePublic: Math.round(analyzer * multiplier),
  };
}

function buildSnapshotRows(
  profileKey: string,
  profileVersion: ProfileVersionRow,
  limit: number,
  candidates: RankingCandidate[],
  scoreFn: ScoreFunction,
  periodStart: string,
  periodEnd: string
): Record<string, unknown>[] {
  const publicCandidates = candidates.filter((candidate) => candidate.visibility === "public");
  const scored = publicCandidates.map((candidate) => ({
    candidate,
    score: scoreFn(candidate),
  }));

  scored.sort((a, b) => {
    if (b.score.score !== a.score.score) {
      return b.score.score - a.score.score;
    }
    const aDate = Date.parse(a.candidate.versionCreatedAt ?? "") || 0;
    const bDate = Date.parse(b.candidate.versionCreatedAt ?? "") || 0;
    return bDate - aDate;
  });

  return scored.slice(0, limit).map((entry, index) => ({
    profile_key: profileKey,
    profile_version_id: profileVersion.id,
    period_start: periodStart,
    period_end: periodEnd,
    rank_position: index + 1,
    project_id: entry.candidate.projectId,
    version_id: entry.candidate.versionId,
    artist_id: entry.candidate.artistId,
    score_0_100: entry.score.score,
    score_public: entry.score.scorePublic,
    track_title: entry.candidate.metadata.trackTitle,
    artist_name: entry.candidate.metadata.artistName,
    cover_url: entry.candidate.metadata.coverUrl,
    audio_url: entry.candidate.metadata.audioUrl,
    mix_type: entry.candidate.metadata.mixType,
    genre: entry.candidate.metadata.genre,
  }));
}

function toErrorPayload(error: unknown): { message: string; raw?: unknown } {
  if (error instanceof Error) {
    return { message: error.message, raw: { name: error.name, stack: error.stack } };
  }
  if (typeof error === "object" && error !== null) {
    const anyErr = error as Record<string, unknown>;
    const msg =
      (typeof anyErr.message === "string" && anyErr.message) ||
      (typeof anyErr.error === "string" && anyErr.error) ||
      "Unknown error";
    return { message: msg, raw: anyErr };
  }
  return { message: String(error) };
}

function getSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL) {
    throw new Error("Missing Supabase URL");
  }
  const key = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Supabase key is not configured");
  }
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchLatestProfileVersion(
  supabase: SupabaseClient,
  profileKey: string
): Promise<ProfileVersionRow | null> {
  const { data, error } = await supabase
    .from(PROFILE_VERSIONS_TABLE)
    .select("id, profile_key, config, created_at")
    .eq("profile_key", profileKey)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as ProfileVersionRow | null;
}

async function fetchArtists(
  supabase: SupabaseClient,
  artistIds: string[]
): Promise<ArtistRow[]> {
  const artists: ArtistRow[] = [];

  for (const chunk of chunkArray(artistIds, ARTIST_CHUNK_SIZE)) {
    if (chunk.length === 0) continue;

    const { data, error } = await supabase
      .from(ARTISTS_TABLE)
      .select("id, artist_name")
      .in("id", chunk);

    if (error) throw error;

    const rows = (data ?? []) as ArtistRow[];
    if (rows.length > 0) artists.push(...rows);
  }

  return artists;
}

async function fetchLatestVersionsFromView(
  supabase: SupabaseClient
): Promise<LatestProjectVersionRow[]> {
  const { data, error } = await supabase
    .from("tekkin_latest_project_version_v1")
    .select(
      "project_id, version_id, created_at, audio_url, audio_path, overall_score, visibility, version_mix_type"
    );

  if (error) throw error;

  return (data ?? []) as LatestProjectVersionRow[];
}

export async function POST(req: Request) {
  try {
    const bearer = req.headers.get("authorization") ?? "";
    const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : undefined;
    if (!token || token !== TEKKIN_CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { start, end } = getWeekPeriod(new Date());
    const periodStart = formatDateOnly(start);
    const periodEnd = formatDateOnly(end);
    const nowIso = new Date().toISOString();

    const [globalProfile, qualityProfile] = await Promise.all([
      fetchLatestProfileVersion(supabase, "global"),
      fetchLatestProfileVersion(supabase, "quality"),
    ]);

    if (!globalProfile || !qualityProfile) {
      return NextResponse.json(
        { error: "Missing published rank profile versions" },
        { status: 500 }
      );
    }

    const latestVersions = await fetchLatestVersionsFromView(supabase);
    const projectIds = Array.from(
      new Set(latestVersions.map((entry) => entry.project_id).filter(Boolean))
    );

    let projects: ProjectRow[] = [];
    if (projectIds.length > 0) {
      const { data, error } = await supabase
        .from(PROJECTS_TABLE)
        .select("id, user_id, title, cover_url, genre, mix_type")
        .in("id", projectIds);

      if (error) throw error;

      projects = (data ?? []) as ProjectRow[];
    }

    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const artistIds = Array.from(
      new Set((projects ?? []).map((project) => project.user_id).filter(Boolean))
    );
    const artists = await fetchArtists(supabase, artistIds);
    const artistMap = new Map(artists.map((artist) => [artist.id, artist]));

    const candidates: RankingCandidate[] = [];

    for (const version of latestVersions) {
      const project = projectMap.get(version.project_id);
      if (!project || !project.user_id) {
        throw new Error(`projects.user_id mancante per project_id=${version.project_id}`);
      }

      const metadata = {
        trackTitle: project.title,
        artistName: artistMap.get(project.user_id)?.artist_name ?? null,
        coverUrl: project.cover_url,
        genre: project.genre,
        mixType: version.version_mix_type ?? project.mix_type ?? null,
        audioUrl: version.audio_url ?? version.audio_path ?? null,
      };

      const analyzerScore =
        typeof version.overall_score === "number"
          ? version.overall_score
          : Number(version.overall_score ?? 0);

      candidates.push({
        projectId: version.project_id,
        versionId: version.version_id,
        artistId: project.user_id,
        analyzerScore,
        likesTotal: 0,
        playsTotal: 0,
        downloadsTotal: 0,
        visibility: version.visibility ?? null,
        versionCreatedAt: version.created_at,
        updatedAt: nowIso,
        metadata,
      });
    }

    const metricsPayload: MetricsRow[] = candidates.map((candidate) => ({
      version_id: candidate.versionId,
      project_id: candidate.projectId,
      artist_id: candidate.artistId,
      analyzer_score_0_100: candidate.analyzerScore,
      // TODO: surface likes/plays/downloads once we collect engagement data
      likes_total: candidate.likesTotal,
      plays_total: candidate.playsTotal,
      signal_downloads_total: candidate.downloadsTotal,
      visibility: candidate.visibility,
      release_date: parseDateValue(candidate.versionCreatedAt),
      updated_at: candidate.updatedAt,
    }));

    let metricsUpserted = 0;

    for (const chunk of chunkArray(metricsPayload, METRIC_CHUNK_SIZE)) {
      if (chunk.length === 0) {
        continue;
      }

      const { error } = await supabase
        .from(METRICS_TABLE)
        .upsert(chunk, { onConflict: "version_id" });

      if (error) {
        throw error;
      }

      metricsUpserted += chunk.length;
    }

    const { error: deleteError } = await supabase
      .from(SNAPSHOT_TABLE)
      .delete()
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .in("profile_key", ["global", "quality"]);

    if (deleteError) {
      throw deleteError;
    }

    const globalRows = buildSnapshotRows(
      "global",
      globalProfile,
      100,
      candidates,
      (candidate) => computeGlobalScore(candidate, globalProfile.config),
      periodStart,
      periodEnd
    );

    const qualityRows = buildSnapshotRows(
      "quality",
      qualityProfile,
      10,
      candidates,
      (candidate) => computeQualityScore(candidate, qualityProfile.config),
      periodStart,
      periodEnd
    );

    const allSnapshotRows = [...globalRows, ...qualityRows];
    let snapshotsWritten = 0;

    if (allSnapshotRows.length > 0) {
      const { error } = await supabase.from(SNAPSHOT_TABLE).insert(allSnapshotRows);
      if (error) {
        throw error;
      }
      snapshotsWritten = allSnapshotRows.length;
    }

    return NextResponse.json({
      ok: true,
      metrics_upserted: metricsUpserted,
      snapshots_written: snapshotsWritten,
    });
  } catch (error) {
    console.error("Tekkin charts rebuild failed", error);
    return NextResponse.json({ error: toErrorPayload(error) }, { status: 500 });
  }
}
