import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { notify } from "@/lib/notifications/notify";
import { mapProjectVersionRowToTrackSnapshot } from "@/lib/tracks/trackSnapshot";

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

    const { data: latestVersion, error: latestErr } = await supabase
      .from("project_versions")
      .select("id")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) {
      console.error("[discovery][request] latest version err", latestErr);
      return NextResponse.json(
        { error: "Errore risolvendo la versione del progetto" },
        { status: 500 }
      );
    }

    if (!latestVersion?.id) {
      return NextResponse.json(
        { error: "Nessuna versione trovata per questo progetto" },
        { status: 400 }
      );
    }

    const version_id = latestVersion.id as string;

    const { data: insertData, error: insertError } = await supabase
      .from("discovery_requests")
      .insert({
        sender_id: user.id,
        receiver_id,
        project_id,
        version_id,
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
    const signalType = `signal_${kind}_received`;

    await notify({
      userId: receiver_id,
      type: signalType,
      title: "Nuovo Signal ricevuto",
      body:
        kind === "promo"
          ? "Hai ricevuto una richiesta promo anonima."
          : "Hai ricevuto una richiesta collab anonima.",
      href: "/discovery",
      data: { request_id: insertData.id, project_id, version_id, kind },
    });

    async function ensureDiscoveryTrack(projectId: string, ownerId: string, versionId: string) {
      const { data: version, error: versionErr } = await supabase
        .from("project_versions")
        .select(
          "id, project_id, genre, version_name, mix_type, overall_score, master_score, bass_energy, has_vocals, bpm, audio_path, audio_url, visibility, waveform_peaks, waveform_bands, waveform_duration, created_at, analyzer_bpm, analyzer_key"
        )
        .eq("id", versionId)
        .maybeSingle();

      if (versionErr) {
        console.error("[discovery][request] discovery_tracks source error", versionErr);
        return;
      }

      if (!version) return;

        const snapshot = mapProjectVersionRowToTrackSnapshot(version as any);
        const resolvedVersionId = snapshot.versionId;
        if (!resolvedVersionId) return;
        const audioValue = snapshot.audioPath ?? snapshot.audioUrl ?? null;

        try {
          const { error: upsertErr } = await admin.from("discovery_tracks").upsert(
            {
              owner_id: ownerId,
              project_id: projectId,
              version_id: resolvedVersionId,
              genre: typeof version.genre === "string" && version.genre.trim() ? version.genre : "unknown",
              overall_score: snapshot.overallScore ?? null,
              master_score: version.master_score ?? null,
              bass_energy: version.bass_energy ?? null,
              has_vocals:
                typeof version.has_vocals === "boolean" ? version.has_vocals : null,
              bpm: snapshot.analyzerBpm ?? null,
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

    void ensureDiscoveryTrack(project_id, user.id, version_id);

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
