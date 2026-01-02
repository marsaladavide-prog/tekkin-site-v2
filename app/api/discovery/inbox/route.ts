import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getTrackUrlCached } from "@/lib/storage/getTrackUrlCached";

type DiscoveryMessage = {
  id: string;
  request_id: string;
  sender_id: string | null;
  receiver_id: string | null;
  message: string;
  created_at: string;
};

export const runtime = "nodejs";

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
    const hasVocalsParam = searchParams.get("has_vocals");
    const minScoreParam = searchParams.get("min_score");

    const hasVocals =
      hasVocalsParam === null ? null : hasVocalsParam === "true";

    const minScore = minScoreParam ? Number(minScoreParam) : null;

    // 1) prendo richieste pending per questo utente
    let reqQuery = supabase
      .from("discovery_requests")
      .select("*")
      .eq("receiver_id", user.id);

    if (kind) {
      reqQuery = reqQuery.eq("kind", kind);
    }

    const { data: requests, error: reqError } = await reqQuery;

    if (reqError) {
      console.error("[discovery][inbox] reqError", reqError);
      return NextResponse.json(
        { error: "Errore caricando le richieste" },
        { status: 500 }
      );
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const projectIds = [...new Set(requests.map((r) => r.project_id))];
    const senderIds = [
      ...new Set(requests.map((r) => r.sender_id).filter(Boolean)),
    ];


    const { data: projectRows, error: projectError } = await supabase
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

    const projectById = new Map((projectRows ?? []).map((p) => [p.id, p]));

    const senderProfiles = new Map<string, { artist_name: string | null; avatar_url: string | null }>();
    if (senderIds.length > 0) {
      const { data: senderRows, error: senderErr } = await supabase
        .from("users_profile")
        .select("id, artist_name, avatar_url")
        .in("id", senderIds);

      if (senderErr) {
        console.error("[discovery][inbox] sender profile err", senderErr);
      } else {
        (senderRows ?? []).forEach((row) => {
          if (row?.id) {
            senderProfiles.set(row.id, {
              artist_name: row.artist_name ?? null,
              avatar_url: row.avatar_url ?? null,
            });
          }
        });
      }
    }

    let trackQuery = supabase
      .from("discovery_tracks")
      .select("*")
      .in("project_id", projectIds)
      .eq("is_enabled", true);

    if (genre) {
      trackQuery = trackQuery.eq("genre", genre);
    }

    if (hasVocals !== null) {
      trackQuery = trackQuery.eq("has_vocals", hasVocals);
    }

    if (minScore !== null && !Number.isNaN(minScore)) {
      trackQuery = trackQuery.gte("overall_score", minScore);
    }

    const { data: tracks, error: trackError } = await trackQuery;

    if (trackError) {
      console.error("[discovery][inbox] trackError", trackError);
      return NextResponse.json(
        { error: "Errore caricando le tracce discovery" },
        { status: 500 }
      );
    }

    const AUDIO_BUCKET = "tracks";
    const URL_MODE: "public" | "signed" = "signed";
    const admin = createAdminClient();

    async function signAudio(raw: string | null | undefined) {
      if (!raw) return null;
      const trimmed = raw.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("http")) return trimmed;
      const normalized = trimmed.startsWith("tracks/")
        ? trimmed.slice("tracks/".length)
        : trimmed;
      return getTrackUrlCached(admin, AUDIO_BUCKET, normalized, {
        mode: URL_MODE,
        expiresInSeconds: 60 * 60,
        revalidateSeconds: 60 * 20,
      });
    }

    const trackByProjectId = new Map<string, any>();
    await Promise.all(
      (tracks ?? []).map(async (t) => {
        const audioUrl = await signAudio(t.audio_url);
        trackByProjectId.set(t.project_id, { ...t, audio_url: audioUrl ?? t.audio_url });
      })
    );

    if (trackByProjectId.size === 0) {
      console.warn("[discovery][inbox] no discovery_tracks entries");
    }

    const { data: versionRows, error: versionErr } = await supabase
      .from("project_versions")
      .select("project_id, audio_path, audio_url, analyzer_bpm, analyzer_key")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    if (versionErr) {
      console.error("[discovery][inbox] project_versions err", versionErr);
    }

    const versionByProjectId = new Map<string, any>();
    const versionCountByProjectId = new Map<string, number>();
    for (const v of versionRows ?? []) {
      if (!v?.project_id) continue;
      if (!versionByProjectId.has(v.project_id)) {
        versionByProjectId.set(v.project_id, v);
      }
      versionCountByProjectId.set(
        v.project_id,
        (versionCountByProjectId.get(v.project_id) ?? 0) + 1
      );
    }

    const requestIds = requests.map((r) => r.id);
    const { data: messageRows, error: messageErr } = await supabase
      .from("discovery_messages")
      .select("id, request_id, sender_id, receiver_id, message, created_at")
      .in("request_id", requestIds)
      .order("created_at", { ascending: true });

    if (messageErr) {
      console.error("[discovery][inbox] messages err", messageErr);
    }

    const messagesByRequest = new Map<string, DiscoveryMessage[]>();
    (messageRows ?? []).forEach((msg) => {
      if (!msg?.request_id) return;
      const entry = messagesByRequest.get(msg.request_id) ?? [];
      entry.push({
        id: msg.id,
        request_id: msg.request_id,
        sender_id: msg.sender_id ?? null,
        receiver_id: msg.receiver_id ?? null,
        message: msg.message,
        created_at: msg.created_at,
      });
      messagesByRequest.set(msg.request_id, entry);
    });

    const result = await Promise.all(
      requests.map(async (r) => {
        let t = trackByProjectId.get(r.project_id);
        const version = versionByProjectId.get(r.project_id);
        if (!t && version) {
          console.info(
            "[discovery][inbox] fallback to project_versions",
            r.project_id
          );
          const audioUrl =
            (await signAudio(
              version.audio_path ?? version.audio_url ?? null
            )) ?? null;
          t = { ...version, audio_url: audioUrl };
        }
        if (!t?.audio_url) {
          console.warn("[discovery][inbox] track missing audio_url", r.project_id);
        }
        const sender = senderProfiles.get(r.sender_id ?? "");
        return {
          request_id: r.id,
          kind: r.kind,
          project_id: r.project_id,
          project_title: projectById.get(r.project_id)?.title ?? "Project",
          project_cover_url: projectById.get(r.project_id)?.cover_url ?? null,
          status: r.status ?? "pending",
          sender_id: r.sender_id ?? null,
          sender_name: sender?.artist_name ?? null,
          sender_avatar: sender?.avatar_url ?? null,
          // qui NON restituiamo sender_id
          genre: t?.genre ?? version?.genre ?? null,
          overall_score: t?.overall_score ?? null,
          mix_score: t?.mix_score ?? null,
          master_score: t?.master_score ?? null,
          bass_energy: t?.bass_energy ?? null,
          has_vocals: t?.has_vocals ?? null,
          bpm: t?.bpm ?? version?.analyzer_bpm ?? null,
          key: t?.key ?? t?.analyzer_key ?? version?.analyzer_key ?? null,
          audio_url: t?.audio_url ?? null,
          message: r.message,
          messages: messagesByRequest.get(r.id) ?? [],
          version_count: versionCountByProjectId.get(r.project_id) ?? 0,
        };
      })
    );

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[discovery][inbox] unexpected", err);
    return NextResponse.json(
      { error: "Errore inatteso" },
      { status: 500 }
    );
  }
}
