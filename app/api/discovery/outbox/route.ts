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

type OutboxItem = {
  request_id: string;
  kind: "collab" | "promo" | string;
  project_id: string;
  version_id: string | null;
  project_title: string;
  project_cover_url: string | null;
  status: "pending" | "accepted" | "rejected" | string;
  receiver_id: string;
  receiver_name: string | null;
  receiver_avatar: string | null;
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
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
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
    const status = searchParams.get("status");

    let reqQuery = supabase
      .from("discovery_requests")
      .select(
        "id, sender_id, receiver_id, project_id, kind, message, status, created_at, version_id"
      )
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false });

    if (isNonEmptyString(kind)) reqQuery = reqQuery.eq("kind", kind);
    if (isNonEmptyString(status)) reqQuery = reqQuery.eq("status", status);

    const { data: requestsRaw, error: reqError } = await reqQuery;
    if (reqError) {
      console.error("[discovery][outbox] reqError", reqError);
      return NextResponse.json(
        { error: "Errore caricando le richieste" },
        { status: 500 }
      );
    }

    const requests = (requestsRaw ?? []) as RequestRow[];
    if (requests.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const projectIds = [...new Set(requests.map((r) => r.project_id).filter(isNonEmptyString))];
    const receiverIds = [
      ...new Set(requests.map((r) => r.receiver_id).filter(isNonEmptyString)),
    ];

    // Projects
    const { data: projectRowsRaw, error: projectError } = await supabase
      .from("projects")
      .select("id, title, cover_url")
      .in("id", projectIds);

    if (projectError) {
      console.error("[discovery][outbox] projectError", projectError);
      return NextResponse.json(
        { error: "Errore caricando i progetti" },
        { status: 500 }
      );
    }

    const projectRows = (projectRowsRaw ?? []) as ProjectRow[];
    const projectById = new Map<string, ProjectRow>(
      projectRows.map((p) => [p.id, p])
    );

    // Receiver profiles
    const receiverById = new Map<string, ProfileRow>();
    if (receiverIds.length > 0) {
      const { data: receiverRowsRaw, error: receiverError } = await supabase
        .from("users_profile")
        .select("id, artist_name, avatar_url")
        .in("id", receiverIds);

      if (receiverError) {
        console.error("[discovery][outbox] receiverError", receiverError);
        return NextResponse.json(
          { error: "Errore caricando i destinatari" },
          { status: 500 }
        );
      }

      const receiverRows = (receiverRowsRaw ?? []) as ProfileRow[];
      receiverRows.forEach((row) => {
        if (isNonEmptyString(row?.id)) receiverById.set(row.id, row);
      });
    }

    // Discovery tracks
    const { data: tracksRaw, error: trackError } = await supabase
      .from("discovery_tracks")
      .select(
        "project_id, genre, overall_score, master_score, bass_energy, has_vocals, bpm, version_id"
      )
      .in("project_id", projectIds)
      .eq("is_enabled", true);

    if (trackError) {
      console.error("[discovery][outbox] trackError", trackError);
      return NextResponse.json(
        { error: "Errore caricando le tracce discovery" },
        { status: 500 }
      );
    }

    const tracks = (tracksRaw ?? []) as DiscoveryTrackRow[];

    // Latest versions fallback
    const { data: versionRowsRaw, error: versionErr } = await supabase
      .from("project_versions")
      .select(
        "id, project_id, audio_path, audio_url, analyzer_bpm, analyzer_key, analyzer_profile_key, created_at"
      )
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    if (versionErr) console.error("[discovery][outbox] project_versions err", versionErr);

    const versionRows = (versionRowsRaw ?? []) as VersionRow[];
    const latestVersionByProjectId = new Map<string, VersionRow>();
    for (const v of versionRows) {
      if (!isNonEmptyString(v.project_id)) continue;
      if (!latestVersionByProjectId.has(v.project_id)) latestVersionByProjectId.set(v.project_id, v);
    }

    // Messages for outbox too
    const requestIds = requests.map((r) => r.id);
    const { data: messageRowsRaw, error: messageErr } = await supabase
      .from("discovery_messages")
      .select("id, request_id, sender_id, receiver_id, message, created_at")
      .in("request_id", requestIds)
      .order("created_at", { ascending: true });

    if (messageErr) console.error("[discovery][outbox] messages err", messageErr);

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

    const result: OutboxItem[] = await Promise.all(
      requests.map(async (r) => {
        const project = projectById.get(r.project_id);
        const receiverProfile =
          isNonEmptyString(r.receiver_id) ? receiverById.get(r.receiver_id) ?? null : null;

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
          receiver_id: r.receiver_id ?? "",
          receiver_name: receiverProfile?.artist_name ?? null,
          receiver_avatar: receiverProfile?.avatar_url ?? null,
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
        };
      })
    );

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[discovery][outbox] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
