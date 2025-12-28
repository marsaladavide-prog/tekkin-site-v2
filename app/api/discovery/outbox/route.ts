import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getTrackUrlCached } from "@/lib/storage/getTrackUrlCached";

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
    const status = searchParams.get("status");

    let reqQuery = supabase
      .from("discovery_requests")
      .select("*")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false });

    if (kind) reqQuery = reqQuery.eq("kind", kind);
    if (status) reqQuery = reqQuery.eq("status", status);

    const { data: requests, error: reqError } = await reqQuery;

    if (reqError) {
      console.error("[discovery][outbox] reqError", reqError);
      return NextResponse.json(
        { error: "Errore caricando le richieste" },
        { status: 500 }
      );
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const projectIds = [...new Set(requests.map((r) => r.project_id).filter(Boolean))];
    const receiverIds = [
      ...new Set(requests.map((r) => r.receiver_id).filter(Boolean)),
    ];

    // Projects
    const { data: projectRows, error: projectError } = await supabase
      .from("projects")
      .select("id, title")
      .in("id", projectIds);

    if (projectError) {
      console.error("[discovery][outbox] projectError", projectError);
      return NextResponse.json(
        { error: "Errore caricando i progetti" },
        { status: 500 }
      );
    }

    const projectById = new Map((projectRows ?? []).map((p) => [p.id, p]));

    // Discovery tracks
    const { data: tracks, error: trackError } = await supabase
      .from("discovery_tracks")
      .select("*")
      .in("project_id", projectIds)
      .eq("is_enabled", true);

    if (trackError) {
      console.error("[discovery][outbox] trackError", trackError);
      return NextResponse.json(
        { error: "Errore caricando le tracce discovery" },
        { status: 500 }
      );
    }

    const admin = createAdminClient();
    const AUDIO_BUCKET = "tracks";
    const URL_MODE: "public" | "signed" = "signed";

    async function signAudio(raw: string | null | undefined) {
      if (!raw) return null;
      const trimmed = String(raw).trim();
      if (!trimmed) return null;

      // già url assoluto
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;

      // normalizza path
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
        trackByProjectId.set(t.project_id, {
          ...t,
          audio_url: audioUrl ?? t.audio_url,
        });
      })
    );

    // Fallback versions (latest by created_at)
    const { data: versionRows, error: versionErr } = await supabase
      .from("project_versions")
      .select("project_id, audio_path, audio_url, created_at")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    if (versionErr) {
      console.error("[discovery][outbox] project_versions err", versionErr);
    }

    const versionByProjectId = new Map<string, any>();
    for (const v of versionRows ?? []) {
      if (!v?.project_id || versionByProjectId.has(v.project_id)) continue;
      versionByProjectId.set(v.project_id, v);
    }

    // Receivers
    const { data: receiverRows, error: receiverError } = await supabase
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

    const receiverById = new Map((receiverRows ?? []).map((r) => [r.id, r]));

    const result = await Promise.all(
      requests.map(async (r) => {
        let t = trackByProjectId.get(r.project_id);

        if (!t) {
          const version = versionByProjectId.get(r.project_id);
          if (version) {
            const audioUrl =
              (await signAudio(version.audio_path ?? version.audio_url ?? null)) ?? null;

            t = { ...version, audio_url: audioUrl };
          }
        }

        const receiver = r.receiver_id ? receiverById.get(r.receiver_id) : null;

        return {
          request_id: r.id,
          kind: r.kind,
          project_id: r.project_id,
          project_title: projectById.get(r.project_id)?.title ?? "Project",
          status: r.status ?? "pending",
          receiver_id: r.receiver_id,
          receiver_name: receiver?.artist_name ?? null,
          receiver_avatar: receiver?.avatar_url ?? null,

          // Track data (se disponibile)
          genre: t?.genre ?? null,
          overall_score: t?.overall_score ?? null,
          mix_score: t?.mix_score ?? null,
          master_score: t?.master_score ?? null,
          bass_energy: t?.bass_energy ?? null,
          has_vocals: t?.has_vocals ?? null,
          bpm: t?.bpm ?? null,
          audio_url: t?.audio_url ?? null,

          message: r.message ?? null,
        };
      })
    );

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[discovery][outbox] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
