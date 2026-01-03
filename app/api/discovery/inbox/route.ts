import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getTrackUrlCached } from "@/lib/storage/getTrackUrlCached";

export const runtime = "nodejs";

type RequestRow = {
  id: string;
  sender_id: string | null;
  receiver_id: string | null;
  project_id: string;
  kind: "collab" | "promo" | string;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | string;
  created_at: string;
  version_id: string | null;
};

type ProjectRow = {
  id: string;
  title: string | null;
  cover_url: string | null;
};

type ProfileRow = {
  id: string;
  artist_name: string | null;
  avatar_url: string | null;
};

type CollaboratorRow = {
  project_id: string;
  user_id: string;
};

type DiscoveryTrackRow = {
  project_id: string;
  genre: string | null;
  overall_score: number | null;
  master_score: number | null;
  bass_energy: number | null;
  has_vocals: boolean | null;
  bpm: number | null;
  version_id: string | null;
};

type VersionRow = {
  id: string;
  project_id: string;
  audio_path: string | null;
  audio_url: string | null;
  analyzer_bpm: number | null;
  analyzer_key: string | null;
  analyzer_profile_key: string | null;
  created_at: string;
};

type DiscoveryMessage = {
  id: string;
  request_id: string;
  sender_id: string | null;
  receiver_id: string | null;
  message: string;
  created_at: string;
};

type InboxItem = {
  request_id: string;
  kind: "collab" | "promo" | string;
  project_id: string;
  version_id: string | null;
  project_title: string;
  project_cover_url: string | null;
  status: "pending" | "accepted" | "rejected" | string;
  sender_id: string | null;
  sender_name: string | null;
  sender_avatar: string | null;
  collaborators: { user_id: string; name: string | null; avatar: string | null }[];
  genre: string | null;
  overall_score: number | null;
  master_score: number | null;
  bass_energy: number | null;
  has_vocals: boolean | null;
  bpm: number | null;
  key: string | null;
  audio_url: string | null;
  message: string | null;
  messages: DiscoveryMessage[];
  version_count: number;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function toBoolParam(v: string | null): boolean | null {
  if (v === null) return null;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function toNumberParam(v: string | null): number | null {
  if (!isNonEmptyString(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const kind = searchParams.get("kind");
    const genre = searchParams.get("genre");
    const hasVocals = toBoolParam(searchParams.get("has_vocals"));
    const minScore = toNumberParam(searchParams.get("min_score"));

    // Requests (inbox)
    let reqQuery = supabase
      .from("discovery_requests")
      .select(
        "id, sender_id, receiver_id, project_id, kind, message, status, created_at, version_id"
      )
      .eq("receiver_id", user.id);

    if (isNonEmptyString(kind)) reqQuery = reqQuery.eq("kind", kind);

    const { data: requestsRaw, error: reqError } = await reqQuery;
    if (reqError) {
      console.error("[discovery][inbox] reqError", reqError);
      return NextResponse.json(
        { error: "Errore caricando le richieste" },
        { status: 500 }
      );
    }

    const requests = (requestsRaw ?? []) as RequestRow[];
    if (requests.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const projectIds = [...new Set(requests.map((r) => r.project_id))];
    const senderIds = [
      ...new Set(requests.map((r) => r.sender_id).filter(isNonEmptyString)),
    ];

    // Projects
    const { data: projectRowsRaw, error: projectError } = await supabase
      .from("projects")
      .select("id, title, cover_url")
      .in("id", projectIds);

    if (projectError) {
      console.error("[discovery][inbox] projectError", projectError);
      return NextResponse.json(
        { error: "Errore caricando i progetti" },
        { status: 500 }
      );
    }
    const projectRows = (projectRowsRaw ?? []) as ProjectRow[];
    const projectById = new Map<string, ProjectRow>(
      projectRows.map((p) => [p.id, p])
    );

    // Sender profiles
    const senderProfiles = new Map<string, ProfileRow>();
    if (senderIds.length > 0) {
      const { data: senderRowsRaw, error: senderErr } = await supabase
        .from("users_profile")
        .select("id, artist_name, avatar_url")
        .in("id", senderIds);

      if (senderErr) {
        console.error("[discovery][inbox] sender profile err", senderErr);
      } else {
        const senderRows = (senderRowsRaw ?? []) as ProfileRow[];
        senderRows.forEach((row) => {
          if (isNonEmptyString(row?.id)) senderProfiles.set(row.id, row);
        });
      }
    }

    // Collaborators
    const { data: collabRowsRaw, error: collabErr } = await supabase
      .from("project_collaborators")
      .select("project_id, user_id")
      .in("project_id", projectIds);

    if (collabErr) console.error("[discovery][inbox] collab lookup err", collabErr);

    const collabRows = (collabRowsRaw ?? []) as CollaboratorRow[];
    const collabUserIds = [
      ...new Set(collabRows.map((r) => r.user_id).filter(isNonEmptyString)),
    ];

    const collabProfiles = new Map<string, ProfileRow>();
    if (collabUserIds.length > 0) {
      const { data: collabProfileRowsRaw, error: collabProfileErr } = await supabase
        .from("users_profile")
        .select("id, artist_name, avatar_url")
        .in("id", collabUserIds);

      if (collabProfileErr) {
        console.error("[discovery][inbox] collab profile err", collabProfileErr);
      } else {
        const rows = (collabProfileRowsRaw ?? []) as ProfileRow[];
        rows.forEach((row) => {
          if (isNonEmptyString(row?.id)) collabProfiles.set(row.id, row);
        });
      }
    }

    const collabByProjectId = new Map<
      string,
      { user_id: string; name: string | null; avatar: string | null }[]
    >();

    collabRows.forEach((row) => {
      if (!isNonEmptyString(row.project_id) || !isNonEmptyString(row.user_id)) return;
      const list = collabByProjectId.get(row.project_id) ?? [];
      const profile = collabProfiles.get(row.user_id);
      list.push({
        user_id: row.user_id,
        name: profile?.artist_name ?? null,
        avatar: profile?.avatar_url ?? null,
      });
      collabByProjectId.set(row.project_id, list);
    });

    // Discovery tracks (filtered)
    let trackQuery = supabase
      .from("discovery_tracks")
      .select(
        "project_id, genre, overall_score, master_score, bass_energy, has_vocals, bpm, version_id"
      )
      .in("project_id", projectIds)
      .eq("is_enabled", true);

    if (isNonEmptyString(genre)) trackQuery = trackQuery.eq("genre", genre);
    if (hasVocals !== null) trackQuery = trackQuery.eq("has_vocals", hasVocals);
    if (minScore !== null) trackQuery = trackQuery.gte("overall_score", minScore);

    const { data: tracksRaw, error: trackError } = await trackQuery;
    if (trackError) {
      console.error("[discovery][inbox] trackError", trackError);
      return NextResponse.json(
        { error: "Errore caricando le tracce discovery" },
        { status: 500 }
      );
    }
    const tracks = (tracksRaw ?? []) as DiscoveryTrackRow[];

    // Latest versions for fallback + counts
    const { data: versionRowsRaw, error: versionErr } = await supabase
      .from("project_versions")
      .select(
        "id, project_id, audio_path, audio_url, analyzer_bpm, analyzer_key, analyzer_profile_key, created_at"
      )
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    if (versionErr) console.error("[discovery][inbox] project_versions err", versionErr);

    const versionRows = (versionRowsRaw ?? []) as VersionRow[];
    const latestVersionByProjectId = new Map<string, VersionRow>();
    const versionCountByProjectId = new Map<string, number>();

    for (const v of versionRows) {
      if (!isNonEmptyString(v.project_id)) continue;
      if (!latestVersionByProjectId.has(v.project_id)) latestVersionByProjectId.set(v.project_id, v);
      versionCountByProjectId.set(
        v.project_id,
        (versionCountByProjectId.get(v.project_id) ?? 0) + 1
      );
    }

    // Messages
    const requestIds = requests.map((r) => r.id);
    const { data: messageRowsRaw, error: messageErr } = await supabase
      .from("discovery_messages")
      .select("id, request_id, sender_id, receiver_id, message, created_at")
      .in("request_id", requestIds)
      .order("created_at", { ascending: true });

    if (messageErr) console.error("[discovery][inbox] messages err", messageErr);

    const messageRows = (messageRowsRaw ?? []) as DiscoveryMessage[];
    const messagesByRequestId = new Map<string, DiscoveryMessage[]>();
    messageRows.forEach((m) => {
      if (!isNonEmptyString(m.request_id)) return;
      const list = messagesByRequestId.get(m.request_id) ?? [];
      list.push({
        id: m.id,
        request_id: m.request_id,
        sender_id: m.sender_id ?? null,
        receiver_id: m.receiver_id ?? null,
        message: m.message,
        created_at: m.created_at,
      });
      messagesByRequestId.set(m.request_id, list);
    });

    // Signing audio
    const admin = createAdminClient();
    const AUDIO_BUCKET = "tracks";
    const URL_MODE: "public" | "signed" = "signed";

    async function signAudio(raw: string | null | undefined) {
      if (!isNonEmptyString(raw)) return null;
      const trimmed = raw.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

      const normalized = trimmed.startsWith("tracks/")
        ? trimmed.slice("tracks/".length)
        : trimmed;

      return getTrackUrlCached(admin, AUDIO_BUCKET, normalized, {
        mode: URL_MODE,
        expiresInSeconds: 60 * 60,
        revalidateSeconds: 60 * 20,
      });
    }

    function asAbsoluteUrl(raw: string | null | undefined) {
      if (!isNonEmptyString(raw)) return null;
      const trimmed = raw.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      return null;
    }

    const versionAudioCache = new Map<string, string | null>();

    async function resolveVersionAudio(version: VersionRow | null) {
      if (!version) return null;
      if (versionAudioCache.has(version.id)) {
        return versionAudioCache.get(version.id) ?? null;
      }
      const signed = await signAudio(version.audio_path ?? null);
      const resolved = signed ?? asAbsoluteUrl(version.audio_url);
      versionAudioCache.set(version.id, resolved);
      return resolved;
    }

    const trackByProjectId = new Map<string, DiscoveryTrackRow>();
    tracks.forEach((t) => {
      trackByProjectId.set(t.project_id, t);
    });

    const result: InboxItem[] = await Promise.all(
      requests.map(async (r) => {
        const project = projectById.get(r.project_id);
        const sender = isNonEmptyString(r.sender_id) ? senderProfiles.get(r.sender_id) ?? null : null;

        const t = trackByProjectId.get(r.project_id) ?? null;
        const latestV = latestVersionByProjectId.get(r.project_id) ?? null;

        const resolvedVersionId =
          (isNonEmptyString(r.version_id) ? r.version_id : null) ??
          (latestV && isNonEmptyString(latestV.id) ? latestV.id : null);
        const bpm = t?.bpm ?? latestV?.analyzer_bpm ?? null;
        const key = latestV?.analyzer_key ?? null;
        const genre = t?.genre ?? latestV?.analyzer_profile_key ?? null;
        const audioUrl = await resolveVersionAudio(latestV);

        return {
          request_id: r.id,
          kind: r.kind,
          project_id: r.project_id,
          version_id: resolvedVersionId,
          project_title: project?.title ?? "Project",
          project_cover_url: project?.cover_url ?? null,
          status: r.status ?? "pending",
          sender_id: r.sender_id ?? null,
          sender_name: sender?.artist_name ?? null,
          sender_avatar: sender?.avatar_url ?? null,
          collaborators: collabByProjectId.get(r.project_id) ?? [],
          genre,
          overall_score: t?.overall_score ?? null,
          master_score: t?.master_score ?? null,
          bass_energy: t?.bass_energy ?? null,
          has_vocals: t?.has_vocals ?? null,
          bpm,
          key,
          audio_url: audioUrl,
          message: r.message ?? null,
          messages: messagesByRequestId.get(r.id) ?? [],
          version_count: versionCountByProjectId.get(r.project_id) ?? 0,
        };
      })
    );

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[discovery][inbox] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
