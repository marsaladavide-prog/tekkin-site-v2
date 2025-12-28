import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getSupabaseAdmin } from "@/app/api/artist/profile";
import { notify } from "@/lib/notifications/notify";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "Body mancante" }, { status: 400 });
    }

    const { receiver_id, project_id, kind, message } = body;

    if (!receiver_id || !project_id || !kind) {
      return NextResponse.json(
        { error: "receiver_id, project_id e kind sono obbligatori" },
        { status: 400 }
      );
    }

    if (kind !== "collab" && kind !== "promo") {
      return NextResponse.json(
        { error: "kind deve essere 'collab' o 'promo'" },
        { status: 400 }
      );
    }

    const { data: insertData, error: insertError } = await supabase
      .from("discovery_requests")
      .insert({
        sender_id: user.id,
        receiver_id,
        project_id,
        kind,
        message: message ?? null,
        is_anonymous: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[discovery][request] insertError", insertError);
      return NextResponse.json(
        { error: "Errore creando la richiesta" },
        { status: 500 }
      );
    }

    // Notifica con notify
    await notify({
      userId: receiver_id,
      type: "signal_received",
      title: "Nuovo Signal ricevuto",
      body:
        kind === "promo"
          ? "Hai ricevuto una richiesta promo anonima."
          : "Hai ricevuto una richiesta collab anonima.",
      href: "/discovery",
      data: { request_id: insertData.id, project_id },
    });

    async function ensureDiscoveryTrack(projectId: string, ownerId: string) {
      const { data: versions, error: versionErr } = await supabase
        .from("project_versions")
        .select(
          "genre, overall_score, mix_score, master_score, bass_energy, has_vocals, bpm, audio_path, audio_url"
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (versionErr) {
        console.error("[discovery][request] discovery_tracks source error", versionErr);
        return;
      }

      const version = versions?.[0];
      if (!version) return;

      const audioValue =
        typeof version.audio_path === "string" && version.audio_path.trim()
          ? version.audio_path.trim()
          : typeof version.audio_url === "string" && version.audio_url.trim()
          ? version.audio_url.trim()
          : null;

      try {
        const { error: upsertErr } = await admin.from("discovery_tracks").upsert(
          {
            owner_id: ownerId,
            project_id: projectId,
            genre: version.genre ?? null,
            overall_score: version.overall_score ?? null,
            mix_score: version.mix_score ?? null,
            master_score: version.master_score ?? null,
            bass_energy: version.bass_energy ?? null,
            has_vocals:
              typeof version.has_vocals === "boolean" ? version.has_vocals : null,
            bpm: typeof version.bpm === "number" ? version.bpm : null,
            is_enabled: Boolean(audioValue),
            audio_url: audioValue,
          },
          { onConflict: "project_id" }
        );
        if (upsertErr) {
          console.error("[discovery][request] discovery_tracks upsert error", upsertErr);
        } else {
          console.log("[discovery][request] discovery_track seeded", projectId);
        }
      } catch (upsertErr) {
        console.error("[discovery][request] discovery_tracks unexpected", upsertErr);
      }
    }

    void ensureDiscoveryTrack(project_id, user.id);

    return NextResponse.json(
      {
        id: insertData.id,
        status: insertData.status,
        kind: insertData.kind,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[discovery][request] unexpected", err);
    return NextResponse.json(
      { error: "Errore inatteso" },
      { status: 500 }
    );
  }
}
